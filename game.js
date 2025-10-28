// Globální proměnné
let questions = []
let currentQuestionIndex = 0
let totalScore = 0
let correctAnswers = 0
let canSpin = false
let isSpinning = false

const SYMBOL_HEIGHT = 70
const symbols = [
  "symb/icons8-money-50.png",
  "symb/icons8-star-50.png",
  "symb/icons8-cherry-50.png",
  "symb/icons8-plum-50.png",
  "symb/icons8-grapes-50.png",
  "symb/icons8-roulette-50.png",
]

// DOM elementy
const questionText = document.getElementById("questionText")
const optionsContainer = document.getElementById("optionsContainer")
const feedback = document.getElementById("feedback")
const instructions = document.getElementById("instructions")
const totalScoreElement = document.getElementById("totalScore")
const reelsContainer = document.getElementById("reelsContainer")
const spinResultArea = document.getElementById("spinResultArea")
const quizSection = document.getElementById("quizSection")
const slotSection = document.getElementById("slotSection")

function smoothScrollTo(element) {
  element.scrollIntoView({ behavior: "smooth", block: "start" })
}

// Načtení otázek z JSON
async function loadQuestions() {
  try {
    const response = await fetch("questions.json")
    const data = await response.json()
    questions = data.questions
    console.log("[v0] Načteno otázek:", questions.length)
    return true
  } catch (error) {
    console.error("[v0] Chyba při načítání otázek:", error)
    questionText.textContent = "Chyba při načítání otázek!"
    return false
  }
}

// Inicializace hry
async function initGame() {
  console.log("[v0] Inicializace hry")

  localStorage.clear()
  totalScore = 0
  correctAnswers = 0
  totalScoreElement.textContent = totalScore

  // Načtení otázek
  const loaded = await loadQuestions()
  if (!loaded) return

  // Inicializace automatu
  createSymbols()
  initializePositions()

  // Zobrazení první otázky
  showQuestion()

  reelsContainer.addEventListener("click", handleStopClick)
}

// Vytvoření symbolů v automatech
function createSymbols() {
  const reelStrips = document.querySelectorAll(".reel-strip")
  reelStrips.forEach((strip) => {
    strip.innerHTML = ""
    // Vytvoříme 4 sady symbolů pro plynulé scrollování
    for (let i = 0; i < 4; i++) {
      symbols.forEach((symbolUrl) => {
        const div = document.createElement("div")
        div.className = "symbol"
        div.style.backgroundImage = `url(${symbolUrl})`
        strip.appendChild(div)
      })
    }
  })
}

// Inicializace pozic válců
function initializePositions() {
  const reelStrips = document.querySelectorAll(".reel-strip")
  reelStrips.forEach((strip) => {
    strip.style.top = "0px"
    strip.style.transition = "none"
  })
}

// Zobrazení otázky
function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    questionText.innerHTML = `<h2>🎉 TEST DOKONČEN!</h2>
      <p>Tvé konečné skóre: <strong>${totalScore} bodů</strong></p>
      <p>Správně zodpovězeno: <strong>${correctAnswers}/${questions.length}</strong></p>`
    optionsContainer.innerHTML = ""
    instructions.textContent = "Gratulujeme!"
    feedback.textContent = ""
    return
  }

  const question = questions[currentQuestionIndex]
  questionText.textContent = `Otázka ${currentQuestionIndex + 1}/${questions.length}: ${question.text}`

  // Vymazání předchozích možností
  optionsContainer.innerHTML = ""
  feedback.textContent = ""

  // Vytvoření tlačítek s odpověďmi
  for (const [key, value] of Object.entries(question.options)) {
    const button = document.createElement("button")
    button.textContent = `${key}: ${value}`
    button.onclick = () => checkAnswer(key, question.correct)
    optionsContainer.appendChild(button)
  }

  canSpin = false
  updateUI()
}

// Kontrola odpovědi
function checkAnswer(selected, correct) {
  const buttons = optionsContainer.querySelectorAll("button")
  buttons.forEach((btn) => (btn.disabled = true))

  if (selected === correct) {
    correctAnswers++
    feedback.textContent = "✅ SPRÁVNĚ! Kolo se točí!"
    feedback.style.color = "green"
    canSpin = true

    setTimeout(() => {
      smoothScrollTo(slotSection)
      setTimeout(() => {
        startSpin()
      }, 800)
    }, 1000)
  } else {
    feedback.textContent = "❌ ŠPATNĚ! Správná odpověď: " + correct
    feedback.style.color = "red"
    instructions.textContent = "Přecházím na další otázku..."

    setTimeout(() => {
      currentQuestionIndex++
      showQuestion()
    }, 2500)
  }
}

// Aktualizace UI
function updateUI() {
  totalScoreElement.textContent = totalScore

  if (canSpin) {
    reelsContainer.style.cursor = "pointer"
    reelsContainer.style.opacity = "1"
    instructions.textContent = "Klikni na automat pro zastavení!"
  } else {
    reelsContainer.style.cursor = "not-allowed"
    reelsContainer.style.opacity = "1"
    instructions.textContent = "Odpověz správně a roztočíš kolo!"
  }
}

function handleStopClick() {
  if (!isSpinning) {
    console.log("[v0] Kolo se netočí, nelze zastavit")
    return
  }

  console.log("[v0] Zastavuji točení")
  stopSpin()
}

// Spuštění točení
function startSpin() {
  if (isSpinning) return

  isSpinning = true
  canSpin = false
  instructions.textContent = "Kolo se točí! Klikni pro zastavení!"
  reelsContainer.style.cursor = "pointer"

  window.targetCombination = [
    Math.floor(Math.random() * symbols.length),
    Math.floor(Math.random() * symbols.length),
    Math.floor(Math.random() * symbols.length),
  ]

  console.log("[v0] Cílová kombinace:", window.targetCombination)

  // Spuštění animace všech válců - nekonečné točení
  const reelStrips = document.querySelectorAll(".reel-strip")

  window.spinIntervals = []

  reelStrips.forEach((strip, index) => {
    strip.style.transition = "none"

    let position = 0
    const spinInterval = setInterval(() => {
      position -= 10
      if (position <= -SYMBOL_HEIGHT * symbols.length * 4) {
        position = 0
      }
      strip.style.top = position + "px"
    }, 20)

    window.spinIntervals.push(spinInterval)
  })
}

function stopSpin() {
  if (!isSpinning) return

  console.log("[v0] Zastavuji všechny válce najednou")

  // Zastavení všech intervalů
  window.spinIntervals.forEach((interval) => clearInterval(interval))

  const reelStrips = document.querySelectorAll(".reel-strip")

  // Zastavení všech válců najednou na cílové pozici
  reelStrips.forEach((strip, index) => {
    stopReel(strip, window.targetCombination[index])
  })

  // Zobrazení výsledku po animaci zastavení
  setTimeout(() => {
    const result = calculateWin(window.targetCombination)
    showResult(result)
  }, 600)
}

// Zastavení válce na konkrétním symbolu
function stopReel(strip, symbolIndex) {
  const targetPosition = -(SYMBOL_HEIGHT * (symbols.length + symbolIndex))
  strip.style.transition = "top 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)"
  strip.style.top = targetPosition + "px"
}

// Výpočet výhry
function calculateWin(combination) {
  const [a, b, c] = combination

  // Tři stejné symboly
  if (a === b && b === c) {
    const wins = [10, 8, 6, 5, 5, 12] // Body za každý symbol
    return {
      points: wins[a],
      message: `🎰 TŘI STEJNÉ! +${wins[a]} bodů!`,
    }
  }

  // Dva stejné symboly
  if (a === b || b === c || a === c) {
    return {
      points: 3,
      message: "🎯 DVA STEJNÉ! +3 body!",
    }
  }

  // Žádná výhra
  return {
    points: 1,
    message: "😕 Zkus to příště! +1 bod za pokus",
  }
}

// Zobrazení výsledku
function showResult(result) {
  isSpinning = false
  totalScore += result.points
  updateUI()

  spinResultArea.innerHTML = `
        <div style="color: var(--highlight-color); font-size: 1.5em;">
            ${result.message}
        </div>
        <div style="margin-top: 10px;">
            Celkové skóre: ${totalScore} bodů
        </div>
    `

  instructions.textContent = "Přecházím na další otázku..."
  reelsContainer.style.cursor = "not-allowed"

  setTimeout(() => {
    smoothScrollTo(quizSection)

    setTimeout(() => {
      spinResultArea.innerHTML = ""
      currentQuestionIndex++
      showQuestion()
    }, 1000)
  }, 2500)
}

// Spuštění hry při načtení stránky
document.addEventListener("DOMContentLoaded", initGame)
