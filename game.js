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
let speed = 0; // FIX: Inicializace proměnné speed

let balance = 0; 
let freeSpins = 0;
const SYMBOL_HEIGHT = 70; 
const QUESTIONS_PER_TEST = 5; // FIX: Přidána konstanta

// Symboly musí být v podsložce 'symb'
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

// FIX: Přidána chybějící funkce handleStartGame
async function handleStartGame(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('usernameInput');
    const errorMessage = document.getElementById('errorMessage');
    const username = usernameInput.value.trim();
    
    if (!username) {
        errorMessage.textContent = 'Prosím zadejte jméno.';
        return;
    }
    
    errorMessage.textContent = 'Načítám...';
    
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start_game', username })
        });
        const data = await response.json();
        
        if (data.success && data.user) {
            localStorage.setItem('userId', data.user.id);
            window.location.href = 'test.html';
        } else {
            errorMessage.textContent = data.error || 'Chyba při startu hry.';
        }
    } catch (error) {
        errorMessage.textContent = 'Chyba komunikace se serverem.';
        console.error('Start game error:', error);
    }
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
        console.error('Load game state error:', error);
    }
}

function updateUI() {
    if (userDisplayElement) userDisplayElement.textContent = currentUser;
    if (balanceElement) balanceElement.textContent = balance;
    if (freeSpinsCountElement) freeSpinsCountElement.textContent = freeSpins;
    
    if (reelsContainer) {
        reelsContainer.style.cursor = canSpin ? 'pointer' : 'not-allowed';
    }
    
    if (instructionsElement) {
        instructionsElement.textContent = isSpinning ? 'Klikněte pro zastavení válců.' : (canSpin ? 'Správně! Klikněte (nebo mezerník) pro točení!' : 'Odpověz na otázku.');
    }
}

function displayQuestion(data) {
    const q = data.question;
    optionsContainer.innerHTML = '';
    
    questionContainer.style.display = 'block';

    if (q.text === 'TEST DOKONČEN!') {
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
    const questionTextElement = questionContainer.querySelector('.question-text');
    if (questionTextElement) {
        questionTextElement.innerHTML = `Otázka ${data.questionIndex + 1}/${data.maxQuestions}: ${escapeHtml(q.text)}`;
    }

    for (const key in q.options) {
        const button = document.createElement('button');
        button.textContent = `${key}: ${q.options[key]}`;
        button.dataset.answer = key;
        button.onclick = () => submitAnswer(key);
        optionsContainer.appendChild(button);
    }
}

// FIX: Přidána funkce pro escapování HTML (XSS prevence)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
                    setTimeout(loadGameState, 500); 
                }
            }
        }
    } catch (error) {
        resultHeadline.style.color = 'red';
        resultHeadline.textContent = 'CHYBA';
        resultDetail.textContent = 'Komunikační chyba. Zkuste znovu.';
        optionsContainer.style.display = 'block';
        spinResultArea.style.display = 'none';
        console.error('Submit answer error:', error);
    }
}

// --- Logika Automatu ---

const spinSpeed = 20; 
const decelerationDuration = 1500; 

// FIX: Přidána chybějící funkce generateCombination
function generateCombination() {
    const combination = [];
    for (let i = 0; i < 3; i++) {
        combination.push(Math.floor(Math.random() * symbols.length));
    }
    return combination;
}

// FIX: Přidána chybějící funkce calculateWin
function calculateWin(combination) {
    const [a, b, c] = combination;
    
    // Kontrola všech tří stejných symbolů
    if (a === b && b === c) {
        const symbolIndex = a;
        let win = 0;
        let addFreeSpins = 0;
        let message = '';
        
        switch(symbolIndex) {
            case 0: // Money
                win = 5;
                message = 'Tři peníze! +5 bodů!';
                break;
            case 1: // Star
                win = 3;
                addFreeSpins = 1;
                message = 'Tři hvězdy! +3 body a +1 volné zatočení!';
                break;
            case 2: // Cherry
                win = 2;
                message = 'Tři třešně! +2 body!';
                break;
            case 3: // Plum
                win = 2;
                message = 'Tři švestky! +2 body!';
                break;
            case 4: // Grapes
                win = 2;
                message = 'Tři hrozny! +2 body!';
                break;
            case 5: // Roulette
                win = 4;
                message = 'Tři rulety! +4 body!';
                break;
        }
        
        return { win, addFreeSpins, message };
    }
    
    // Kontrola dvou stejných
    if (a === b || b === c || a === c) {
        return { win: 1, addFreeSpins: 0, message: 'Dva stejné symboly! +1 bod!' };
    }
    
    // Žádná výhra
    return { win: 0, addFreeSpins: 0, message: 'Bohužel žádná výhra. Zkus to znovu!' };
}

// FIX: Přidána chybějící funkce saveSpinResult
async function saveSpinResult(points, addFreeSpins) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'save_spin_result', 
                userId, 
                points, 
                freeSpinsAdd: addFreeSpins 
            })
        });
        const data = await response.json();

        if (data.success) {
            balance = data.newScore;
            freeSpins += addFreeSpins;
            updateUI();
            
            // Čekání před načtením další otázky
            setTimeout(() => {
                loadGameState();
            }, 3000);
        } else {
            resultHeadline.textContent = 'CHYBA';
            resultDetail.textContent = 'Nepodařilo se uložit výsledek.';
        }
    } catch (error) {
        console.error('Save spin result error:', error);
        resultHeadline.textContent = 'CHYBA';
        resultDetail.textContent = 'Komunikační chyba při ukládání výsledku.';
    }
}

function spin(reelIndex) {
    if (!spinningReels[reelIndex]) return;
    
    const strip = reelStrips[reelIndex];
    const symbolsPerSet = symbols.length;
    const totalStripHeight = SYMBOL_HEIGHT * symbolsPerSet * 4;
    
    // Zrychlení (pouze pro první válec)
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
    
    // Cíl je 2. symbol v druhé sadě
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
            resultDetail.innerHTML = `Vytočená výhra: <strong>${result.win} bodů</strong>. ${escapeHtml(result.message)}`;

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
        if (instructionsElement) {
            instructionsElement.textContent = 'Nejdříve správně odpověz na otázku!';
        }
        return;
    }
    
    if (!isSpinning && currentReel === 0 && canSpin) {
        // START TOČENÍ (první klik)
        if (instructionsElement) {
            instructionsElement.textContent = 'Válec 1 se točí... Klikněte pro zastavení.';
        }
        
        if (freeSpins > 0) {
            freeSpins--;
        }

        nextCombination = generateCombination();
        isSpinning = true;
        spinningReels = [true, true, true];
        currentReel = 0;
        canSpin = false;
        
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
            
            if (instructionsElement) {
                if (currentReel < 3) {
                    instructionsElement.textContent = `Válec ${currentReel + 1} se točí... Klikněte pro zastavení.`;
                } else {
                    instructionsElement.textContent = 'Čekám na vyhodnocení výhry...';
                }
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