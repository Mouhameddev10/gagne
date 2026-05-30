const express = require('express');
const session = require('express-session');
const path = require('path');
const { router: quizRouter, getDrawPeriod } = require('./routes/quiz');
const statsRouter = require('./routes/stats');
const { initCron, forceDraw } = require('./cron/draw');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'quizloto-secret-key-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use(quizRouter);
app.use(statsRouter);

app.get('/api/draw/force', (req, res) => {
    const period = req.query.period || getDrawPeriod();
    forceDraw(period, (err, result) => {
        if (err) return res.status(500).json({ error: 'Draw failed' });
        res.json(result);
    });
});

initCron();

app.listen(PORT, () => {
    console.log(`QuizLoto server running on http://localhost:${PORT}`);
});
