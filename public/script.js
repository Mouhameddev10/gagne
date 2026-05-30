let questions = [];
let currentQuestionIndex = 0;
let quizSessionId = null;
let isAnswering = false;

const startScreen = document.getElementById('startScreen');
const quizScreen = document.getElementById('quizScreen');
const resultScreen = document.getElementById('resultScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const ticketCounter = document.getElementById('ticketsToday');
const resultMessage = document.getElementById('resultMessage');
const adModal = document.getElementById('adModal');
const adTimer = document.getElementById('adTimer');
const closeAdBtn = document.getElementById('closeAdBtn');
const nextDrawEl = document.getElementById('nextDraw');

async function fetchQuestions() {
    try {
        const response = await fetch('/api/questions');
        questions = await response.json();
    } catch (error) {
        console.error('Error fetching questions:', error);
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/user/stats');
        const data = await response.json();
        ticketCounter.textContent = data.tickets_today;
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function startQuiz() {
    try {
        const response = await fetch('/api/quiz/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        quizSessionId = data.sessionId;
        currentQuestionIndex = 0;
        
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        
        displayQuestion();
    } catch (error) {
        console.error('Error starting quiz:', error);
        alert('Une erreur est survenue. Veuillez réessayer.');
    }
}

function displayQuestion() {
    const question = questions[currentQuestionIndex];
    questionText.textContent = question.text;
    progressText.textContent = `Question ${currentQuestionIndex + 1}/10`;
    progressFill.style.width = `${((currentQuestionIndex + 1) / 10) * 100}%`;
    
    optionsContainer.innerHTML = '';
    question.options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span class="option-label">${option.label}</span><span>${option.text}</span>`;
        btn.onclick = () => selectAnswer(option.label);
        optionsContainer.appendChild(btn);
    });
    
    isAnswering = false;
}

async function selectAnswer(answer) {
    if (isAnswering) return;
    isAnswering = true;
    
    document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
    
    try {
        await fetch('/api/quiz/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: quizSessionId,
                questionIndex: currentQuestionIndex,
                answer: answer
            })
        });
        
        if (currentQuestionIndex < 9) {
            showAd(() => {
                currentQuestionIndex++;
                displayQuestion();
            });
        } else {
            completeQuiz();
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('Une erreur est survenue. Veuillez réessayer.');
        isAnswering = false;
    }
}

function showAd(callback) {
    adModal.classList.remove('hidden');
    closeAdBtn.disabled = true;
    let countdown = 3;
    adTimer.textContent = countdown;
    
    const timer = setInterval(() => {
        countdown--;
        adTimer.textContent = countdown;
        
        if (countdown === 0) {
            clearInterval(timer);
            closeAdBtn.disabled = false;
            closeAdBtn.onclick = () => {
                adModal.classList.add('hidden');
                callback();
            };
        }
    }, 1000);
}

async function completeQuiz() {
    try {
        const response = await fetch('/api/quiz/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: quizSessionId })
        });
        const data = await response.json();
        
        quizScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');
        
        resultMessage.textContent = data.message;
        resultMessage.className = 'result-message ' + (data.ticket_granted ? 'success' : 'info');
        
        await fetchStats();
    } catch (error) {
        console.error('Error completing quiz:', error);
        alert('Une erreur est survenue. Veuillez réessayer.');
    }
}

function updateNextDraw() {
    nextDrawEl.textContent = "dans 2 mois";
}

startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', startQuiz);

window.addEventListener('load', async () => {
    await fetchQuestions();
    await fetchStats();
    updateNextDraw();
});
