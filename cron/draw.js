const cron = require('node-cron');
const db = require('../db');

const getPreviousPeriod = (date = new Date()) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    let periodIndex = Math.floor(month / 2) - 1;
    let periodYear = year;
    
    if (periodIndex < 0) {
        periodIndex = 5;
        periodYear = year - 1;
    }
    
    return `${periodYear}-${periodIndex.toString().padStart(2, '0')}`;
};

const performDraw = () => {
    const period = getPreviousPeriod();
    console.log(`Starting draw for period: ${period}`);
    
    db.all('SELECT * FROM tickets WHERE draw_period = ?', [period], (err, tickets) => {
        if (err) {
            console.error('Error fetching tickets:', err);
            return;
        }
        
        if (tickets.length === 0) {
            console.log('No tickets found for this period.');
            return;
        }
        
        const winnerIndex = Math.floor(Math.random() * tickets.length);
        const winningTicket = tickets[winnerIndex];
        
        db.run('INSERT INTO winners (period, user_id, amount) VALUES (?, ?, 250000)', [period, winningTicket.user_id], function(err) {
            if (err) {
                console.error('Error saving winner:', err);
                return;
            }
            
            console.log(`🎉 Winner selected! Ticket ID: ${winningTicket.id}, User ID: ${winningTicket.user_id}, Period: ${period}, Amount: 250,000 FCFA`);
        });
    });
};

const forceDraw = (period, callback) => {
    console.log(`Forcing draw for period: ${period}`);
    
    db.all('SELECT * FROM tickets WHERE draw_period = ?', [period], (err, tickets) => {
        if (err) {
            console.error('Error fetching tickets:', err);
            return callback(err);
        }
        
        if (tickets.length === 0) {
            console.log('No tickets found for this period.');
            return callback(null, { message: 'No tickets found' });
        }
        
        const winnerIndex = Math.floor(Math.random() * tickets.length);
        const winningTicket = tickets[winnerIndex];
        
        db.run('INSERT INTO winners (period, user_id, amount) VALUES (?, ?, 250000)', [period, winningTicket.user_id], function(err) {
            if (err) {
                console.error('Error saving winner:', err);
                return callback(err);
            }
            
            const result = {
                success: true,
                winner: {
                    ticketId: winningTicket.id,
                    userId: winningTicket.user_id,
                    period: period,
                    amount: 250000
                }
            };
            
            console.log(`🎉 Winner selected!`, result);
            callback(null, result);
        });
    });
};

const initCron = () => {
    cron.schedule('0 0 1 1,3,5,7,9,11 *', () => {
        performDraw();
    }, {
        scheduled: true,
        timezone: "UTC"
    });
    
    console.log('Draw cron job initialized (runs on 1st of Jan, Mar, May, Jul, Sep, Nov at 00:00 UTC)');
};

module.exports = { initCron, performDraw, forceDraw };
