const jwt = require('jsonwebtoken');


const auth = async (req, res, next) => {

  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token expired' });
    }

    try {
      // verify the access token
       const decoded= jwt.verify(token, process.env.JWT_SECRET);
       req.user = { id: decoded.userId };
       next();
    }
    catch (error) {
      
      // it means access token expired use refresh token to get new access token

      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required' });
      }

      const decoded= jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // console.log('decoded ', decoded);

      const newAccessToken= jwt.sign({id: decoded.id}, process.env.JWT_SECRET, {expiresIn: '15m'});

      req.user = { id: decoded.userId };
      next();
      
    }
  } catch (error) {

    // wrong access token sent
    res.status(401).json({ message: 'Authentication required, Invalid token' });
  }
};

module.exports = auth;
