const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDrawPeriod, getTodayDate } = require('./quiz');

const getOrCreateUser = (sessionId, callback) => {
    db.get('SELECT * FROM users WHERE session_id = ?', [sessionId], (err, user) => {
        if (err) return callback(err);
        if (user) return callback(null, user);
        
        db.run('INSERT INTO users (session_id) VALUES (?)', [sessionId], function(err) {
            if (err) return callback(err);
            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], callback);
        });
    });
};

router.get('/api/user/stats', (req, res) => {
    getOrCreateUser(req.session.id, (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const today = getTodayDate();
        const currentPeriod = getDrawPeriod();
        
        db.get('SELECT tickets_used FROM daily_tickets WHERE user_id = ? AND date = ?', [user.id, today], (err, daily) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            const usedToday = daily ? daily.tickets_used : 0;
            
            db.get('SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND draw_period = ?', [user.id, currentPeriod], (err, result) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                
                res.json({
                    tickets_today: usedToday,
                    tickets_current_period: result.count
                });
            });
        });
    });
});

module.exports = router;
