const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'eventcore-api'
    });
});

module.exports = router;
