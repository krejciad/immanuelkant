// --- Globální proměnné a stav hry ---
let currentUser = null;
let currentQuestionId = null;
let canSpin = false;
let isSpinning = false;
let spinningReels = [false, false, false];
let spinIntervals = [null, null, null];
let currentReel = 0;
let nextCombination = [];
let spinDirection = -1; 
let userId = localStorage.getItem('userId');

let balance = 0; 
let freeSpins = 0;
const SYMBOL_HEIGHT = 70; 

// FIX: Symboly musí být v podsložce 'symb'
const symbols = [
    'symb/icons8-money-50.png',
    'symb/icons8-star-50.png', 	
    'symb/icons8-cherry-50.png',
    'symb/icons8-plum-50.png',
    'symb/icons8-grapes-50.png',
    'symb/icons8-roulette-50.png'
];

// Odkazy na DOM
const reelStrips = document.querySelectorAll('.reel-strip');
const balanceElement = document.getElementById('balance');
const freeSpinsCountElement = document.getElementById('freeSpinsCount');
const instructionsElement = document.getElementById('instructions');
const userDisplayElement = document.getElementById('userDisplay');
const questionContainer = document.getElementById('questionContainer');
const optionsContainer = document.getElementById('optionsContainer');
const reelsContainer = document.getElementById('reelsContainer');
const spinResultArea = document.getElementById('spinResultArea');
const resultHeadline = document.getElementById('resultHeadline');
const resultDetail = document.getElementById('resultDetail');


// --- Inicializace ---
document.addEventListener('DOMContentLoaded', () => {
    const startForm = document.getElementById('startForm');
    if (startForm) {
        startForm.addEventListener('submit', handleStartGame);
    } else if (document.getElementById('testArea')) {
        loadGameState();
    }
    createSymbols();
    initializePositions();
});

function createSymbols() {
    // FIX: Zajištění správné cesty k symbolům a správné výšky
    reelStrips.forEach(strip => {
        strip.innerHTML = ''; 
        for (let i = 0; i < 4; i++) { 
            symbols.forEach((symbolUrl) => {
                const div = document.createElement('div');
                div.className = 'symbol';
                div.style.backgroundImage = `url(${symbolUrl})`;
                strip.appendChild(div);
            });
        }
    });
}

function initializePositions() {
    reelStrips.forEach(strip => {
        strip.style.top = '0px';
        strip.style.transition = 'none';
    });
}

// --- Logika Testu (test.html) ---

async function loadGameState() {
    userId = localStorage.getItem('userId');
    if (!userId && window.location.pathname.endsWith('test.html')) {
        setTimeout(() => window.location.href = 'index.html', 100);
        return;
    }
    
    // Reset stavu UI před načtením nového stavu
    optionsContainer.style.display = 'block';
    spinResultArea.style.display = 'none';
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_game_state', userId })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.username;
            balance = data.score;
            freeSpins = data.freeSpins;
            canSpin = data.canSpin;

            updateUI();
            displayQuestion(data);
        } else {
            userDisplayElement.textContent = data.error;
        }
    } catch (error) {
        userDisplayElement.textContent = 'Chyba komunikace.';
    }
}

function updateUI() {
    userDisplayElement.textContent = currentUser;
    balanceElement.textContent = balance;
    freeSpinsCountElement.textContent = freeSpins;
    
    reelsContainer.style.cursor = canSpin ? 'pointer' : 'not-allowed';
    instructionsElement.textContent = isSpinning ? 'Klikněte pro zastavení válců.' : (canSpin ? 'Správně! Klikněte (nebo mezerník) pro točení!' : 'Odpověz na otázku.');
}

function displayQuestion(data) {
    const q = data.question;
    optionsContainer.innerHTML = '';
    
    questionContainer.style.display = 'block';

    if (q.text === 'TEST DOKONČEN!') {
        // PŘESMĚROVÁNÍ PO DOKONČENÍ TESTU
        instructionsElement.textContent = 'Test dokončen, přesměrování na výsledkovou tabuli...';
        setTimeout(() => window.location.href = 'leaderboard.html', 2000);
        return;
    }
    
    if (q.text === 'GAME OVER' || balance <= 0) {
        questionContainer.innerHTML = `<div class="question-text" style="color: red;"><h2>GAME OVER</h2><p>Došly ti body! Tvé konečné skóre je ${balance} bodů.</p><p>Přesměrování na výsledkovou tabuli...</p></div>`;
        instructionsElement.textContent = 'Hra skončila.';
        reelsContainer.style.cursor = 'not-allowed';
        setTimeout(() => window.location.href = 'leaderboard.html', 3000);
        return;
    }

    currentQuestionId = q.id;
    questionContainer.querySelector('.question-text').innerHTML = `Otázka ${data.questionIndex + 1}/${data.maxQuestions}: ${q.text}`;

    for (const key in q.options) {
        const button = document.createElement('button');
        button.textContent = `${key}: ${q.options[key]}`;
        button.dataset.answer = key;
        button.onclick = () => submitAnswer(key);
        optionsContainer.appendChild(button);
    }
}

async function submitAnswer(answer) {
    if (canSpin || isSpinning) return; 
    
    // Schovat možnosti otázek
    optionsContainer.style.display = 'none';
    spinResultArea.style.display = 'block';
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'submit_answer', userId, answer, questionId: currentQuestionId })
        });
        const data = await response.json();

        if (data.success) {
            if (data.isCorrect) {
                canSpin = true;
                updateUI();
                resultHeadline.style.color = 'var(--highlight-color)';
                resultHeadline.textContent = 'SPRÁVNĚ!';
                resultDetail.textContent = 'Klikněte 3x (nebo 3x mezerník) na automat pro zatočení a získání bodů!';
            } else {
                balance = data.newScore; 
                updateUI();
                resultHeadline.style.color = 'red';
                resultHeadline.textContent = 'ŠPATNĚ!';
                resultDetail.textContent = `Ztrácíš 1 bod. Zbývá bodů: ${balance}. Přecházím na další otázku...`;
                
                if (balance > 0) {
                    setTimeout(loadGameState, 2500); 
                } else {
                    // Game Over
                    setTimeout(loadGameState, 500); 
                }
            }
        }
    } catch (error) {
        // V případě chyby zobrazit možnosti znovu a zprávu
        resultHeadline.style.color = 'red';
        resultHeadline.textContent = 'CHYBA';
        resultDetail.textContent = 'Komunikační chyba. Zkuste znovu.';
        optionsContainer.style.display = 'block';
        spinResultArea.style.display = 'none';
    }
}

// --- Logika Automatu (FIXED SPINNING) ---

const spinSpeed = 20; 
const decelerationDuration = 1500; 

function spin(reelIndex) {
    if (!spinningReels[reelIndex]) return;
    
    const strip = reelStrips[reelIndex];
    const symbolsPerSet = symbols.length;
    const totalStripHeight = SYMBOL_HEIGHT * symbolsPerSet * 4;
    
    // Zrychlení (pouze pro první válec, nebo se používá globální speed)
    let currentSpeed = speed; 
    if (reelIndex === 0 && speed < spinSpeed) {
         speed += 0.5;
         currentSpeed = speed;
    } else if (reelIndex > 0) {
         currentSpeed = spinSpeed;
    }
    
    let currentTop = parseFloat(strip.style.top) || 0;
    let newTop = currentTop + (currentSpeed * spinDirection);
    
    if (Math.abs(newTop) >= totalStripHeight) {
        newTop = 0;
    }
    
    strip.style.top = `${newTop}px`;
    spinIntervals[reelIndex] = requestAnimationFrame(() => spin(reelIndex));
}

function stopReel(reelIndex) {
    if (!spinningReels[reelIndex]) return;
    
    spinningReels[reelIndex] = false;
    cancelAnimationFrame(spinIntervals[reelIndex]);
    
    const strip = reelStrips[reelIndex];
    
    const targetSymbolIndex = nextCombination[reelIndex]; 
    const setIndex = 1; 
    
    // Cíl je 2. symbol v druhé sadě (index 1 * symbol.length + symbol.index)
    const targetPosition = -(SYMBOL_HEIGHT * (setIndex * symbols.length + targetSymbolIndex));
    
    // Přechod pro zastavení
    strip.style.transition = `top ${decelerationDuration / 1000}s cubic-bezier(0.25, 0.1, 0.25, 1)`;
    strip.style.top = `${targetPosition}px`;
    
    if (reelIndex === 2) {
        // Vyhodnocení výhry po zastavení posledního válce
        setTimeout(() => {
            const result = calculateWin(nextCombination);
            
            resultHeadline.style.color = 'var(--highlight-color)';
            resultHeadline.textContent = `VÝSLEDEK ZATOČENÍ: +${result.win} bodů!`;
            resultDetail.innerHTML = `Vytočená výhra: <strong>${result.win} bodů</strong>. ${result.message}`;

            // Reset rychlosti a stavu točení
            speed = 0;
            isSpinning = false;
            currentReel = 0;

            saveSpinResult(result.win, result.addFreeSpins);
        }, decelerationDuration + 200); 
    }
}

function activate() {
    if (!canSpin && !isSpinning) {
        instructionsElement.textContent = 'Nejdříve správně odpověz na otázku!';
        return;
    }
    
    if (!isSpinning && currentReel === 0 && canSpin) {
        // START TOČENÍ (první klik)
        instructionsElement.textContent = 'Válec 1 se točí... Klikněte pro zastavení.';
        
        if (freeSpins > 0) {
            freeSpins--;
        }

        nextCombination = generateCombination();
        isSpinning = true;
        spinningReels = [true, true, true];
        currentReel = 0;
        canSpin = false; // Zakázat klikání na spiny, dokud neproběhnou 3 kliky
        
        reelStrips.forEach((strip, index) => {
            strip.style.transition = 'none';
            strip.style.top = '0px'; 
            spin(index);
        });
        updateUI();

    } else if (isSpinning) {
        // ZASTAVOVÁNÍ VÁLCŮ (druhý, třetí a čtvrtý klik)
        
        if (currentReel < 3) {
            stopReel(currentReel);
            currentReel++;
            
            if (currentReel < 3) {
                 instructionsElement.textContent = `Válec ${currentReel + 1} se točí... Klikněte pro zastavení.`;
            } else {
                 instructionsElement.textContent = 'Čekám na vyhodnocení výhry...';
            }
        }
    }
}

// Podpora pro klávesu mezerníku
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        activate();
    }
});