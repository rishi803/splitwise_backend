const { generateTokens } = require("../utils/jwt");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const auth = require('../middlewares/auth'); // Adjust path as needed


exports.signup = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if email already exists
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error." });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Insert the new user into the database
    db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error." });
        }

        const userId = result.insertId;

        // Generate JWT tokens
        const { token, refreshToken } = generateTokens(userId);

        // Store the refresh token in the database
        db.query(
          "UPDATE users SET refresh_token = ? WHERE id = ?",
          [refreshToken, userId],
          (err) => {
            if (err) {
              console.error(err);
              return res
                .status(500)
                .json({ message: "Error storing refresh token." });
            }

            res
              .cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "Strict",
              })
              .status(201)
              .json({ message: "User registered successfully!", token, refreshToken });
          }
        );
      }
    );
  });
};

exports.login = (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error." });
      }

      if (
        results.length === 0 ||
        !(await bcrypt.compare(password, results[0].password))
      ) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const user = results[0];

      // Generate JWT tokens
      const { token, refreshToken } = generateTokens(user.id);

      // Store the refresh token in the database
      db.query(
        "UPDATE users SET refresh_token = ? WHERE id = ?",
        [refreshToken, user.id],
        (err) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ message: "Error storing refresh token." });
          }

          // Send the tokens to the client and store refresh token in cookie
          // console.log(res
          // .cookie("refreshToken", refreshToken))

          return res.status(200)
          .json({ message: "Login successful!", token, refreshToken });
        }
      );
    }
  );
};
exports.refresh = (req, res) => {
   console.log(req);
    const refreshToken = req.cookies.refreshToken;

    console.log(refreshToken);

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  // Verify the refresh token
  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const userId = decoded.id;

    // Check if the refresh token matches the one stored in the database
    db.query(
      "SELECT * FROM users WHERE id = ? AND refresh_token = ?",
      [userId, refreshToken],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error." });
        }

        if (results.length === 0) {
          return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Generate new access and refresh tokens
        const { token, refreshToken: newRefreshToken } = generateTokens(userId);

        // Update the refresh token in the database
        db.query(
            "UPDATE users SET refresh_token = ? WHERE id = ?",
            [newRefreshToken, userId],
            (err) => {
              if (err) return res.status(500).json({ message: "Error updating refresh token." });
  
              res
                .cookie("refreshToken", newRefreshToken, {
                  httpOnly: true,
                  secure: true,
                  sameSite: "strict",
                })
                .status(200)
                .json({ token });
            }
          );
      }
    );
  });
};
