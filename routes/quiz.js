const express = require('express');
const router = express.Router();
const db = require('../db');
const questions = require('../questions.json');

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

const getDrawPeriod = (date = new Date()) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const periodIndex = Math.floor(month / 2);
    return `${year}-${periodIndex.toString().padStart(2, '0')}`;
};

const getTodayDate = () => {
    const today = new Date();
    return `${today.getUTCFullYear()}-${(today.getUTCMonth() + 1).toString().padStart(2, '0')}-${today.getUTCDate().toString().padStart(2, '0')}`;
};

const getDailyQuestions = () => {
    const today = new Date();
    const dateStr = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
    
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
        seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
        seed = seed & seed;
    }
    
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, 10).map((q, index) => ({
        ...q,
        id: index + 1
    }));
};

router.get('/api/questions', (req, res) => {
    res.json(getDailyQuestions());
});

router.post('/api/quiz/start', (req, res) => {
    getOrCreateUser(req.session.id, (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.run('INSERT INTO quiz_sessions (user_id, answers) VALUES (?, ?)', [user.id, '[]'], function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ sessionId: this.lastID });
        });
    });
});

router.post('/api/quiz/answer', (req, res) => {
    const { sessionId, questionIndex, answer } = req.body;
    
    db.get('SELECT * FROM quiz_sessions WHERE id = ?', [sessionId], (err, session) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        const answers = JSON.parse(session.answers);
        answers[questionIndex] = answer;
        
        db.run('UPDATE quiz_sessions SET answers = ? WHERE id = ?', [JSON.stringify(answers), sessionId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

router.post('/api/quiz/complete', (req, res) => {
    const { sessionId } = req.body;
    
    db.get('SELECT * FROM quiz_sessions WHERE id = ?', [sessionId], (err, session) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        const userId = session.user_id;
        const today = getTodayDate();
        
        db.get('SELECT * FROM daily_tickets WHERE user_id = ? AND date = ?', [userId, today], (err, dailyTicket) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            const usedToday = dailyTicket ? dailyTicket.tickets_used : 0;
            const remainingToday = 5 - usedToday;
            
            if (usedToday >= 5) {
                db.run('UPDATE quiz_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (err) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    res.json({
                        ticket_granted: false,
                        used_today: 5,
                        remaining_today: 0,
                        message: "🎉 Bravo ! Vous faites déjà partie du tirage ! Revenez demain pour accumuler encore plus de tickets et augmenter vos chances de gagner 250 000 FCFA !"
                    });
                });
            } else {
                const drawPeriod = getDrawPeriod();
                
                db.run('UPDATE quiz_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (err) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    
                    db.run('INSERT INTO tickets (user_id, draw_period) VALUES (?, ?)', [userId, drawPeriod], (err) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        
                        if (dailyTicket) {
                            db.run('UPDATE daily_tickets SET tickets_used = tickets_used + 1 WHERE user_id = ? AND date = ?', [userId, today], (err) => {
                                if (err) return res.status(500).json({ error: 'Database error' });
                                res.json({
                                    ticket_granted: true,
                                    used_today: usedToday + 1,
                                    remaining_today: 4 - usedToday,
                                    message: `🎫 Ticket gagné ! Vous faites maintenant partie du tirage ! Continuez à jouer tous les jours pour accumuler ${4 - usedToday} tickets supplémentaires aujourd'hui et augmenter vos chances de gagner 250 000 FCFA !`
                                });
                            });
                        } else {
                            db.run('INSERT INTO daily_tickets (user_id, date, tickets_used) VALUES (?, ?, 1)', [userId, today], (err) => {
                                if (err) return res.status(500).json({ error: 'Database error' });
                                res.json({
                                    ticket_granted: true,
                                    used_today: 1,
                                    remaining_today: 4,
                                    message: "🎫 Félicitations ! Votre premier ticket est gagné ! Vous êtes officiellement dans le tirage ! Continuez tous les jours pour accumuler plus de tickets et augmenter vos chances de remporter 250 000 FCFA !"
                                });
                            });
                        }
                    });
                });
            }
        });
    });
});

module.exports = { router, getDrawPeriod, getTodayDate };
