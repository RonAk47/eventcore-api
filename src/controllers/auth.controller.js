const authService = require('../services/auth.service');

async function register(req, res, next) {
    try {
        const user = await authService.register(req.body);
        return res.status(201).json({ user });
    } catch (error) {
        return next(error);
    }
}

async function login(req, res, next) {
    try {
        const result = await authService.login(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
}

function me(req, res) {
    return res.status(200).json({ user: req.user });
}

module.exports = {
    register,
    login,
    me
};
