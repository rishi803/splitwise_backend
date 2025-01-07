const Joi = require('joi');

exports.validateSignup = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string()
      .required()
      .oneOf([Joi.ref('password')], 'Passwords must match') 
  });

  return schema.validate(data);
};

exports.validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });
  return schema.validate(data);
};

exports.validateGroup = (data) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    memberIds: Joi.array().items(Joi.number()).required()
  });
  return schema.validate(data);
};

exports.validateExpense = (data) => {
  const schema = Joi.object({
    groupId: Joi.number().required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().required()
  });
  return schema.validate(data);
};