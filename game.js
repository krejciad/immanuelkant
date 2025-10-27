// --- Globální proměnné a stav hry ---
let currentUser = null
let currentQuestionId = null
let canSpin = false
let isSpinning = false
let spinningReels = [false, false, false]
const spinIntervals = [null, null, null]
let currentReel = 0
let nextCombination = []
const spinDirection = -1
let userId = null
let speed = 0

let balance = 0
let freeSpins = 0
const SYMBOL_HEIGHT = 70
const QUESTIONS_PER_TEST = 5

const symbols = [
  "symb/icons8-money-50.png",
  "symb/icons8-star-50.png",
  "symb/icons8-cherry-50.png",
  "symb/icons8-plum-50.png",
  "symb/icons8-grapes-50.png",
  "symb/icons8-roulette-50.png",
]

// Odkazy na DOM
const reelStrips = document.querySelectorAll(".reel-strip")
const balanceElement = document.getElementById("balance")
const freeSpinsCountElement = document.getElementById("freeSpinsCount")
const instructionsElement = document.getElementById("instructions")
const userDisplayElement = document.getElementById("userDisplay")
const questionContainer = document.getElementById("questionContainer")
const optionsContainer = document.getElementById("optionsContainer")
const reelsContainer = document.getElementById("reelsContainer")
const spinResultArea = document.getElementById("spinResultArea")
const resultHeadline = document.getElementById("resultHeadline")
const resultDetail = document.getElementById("resultDetail")

// --- Session storage náhrada (in-memory) ---
const sessionData = {
  userId: null,
  setUserId(id) {
    this.userId = id
    try {
      sessionStorage.setItem("userId", id)
    } catch (e) {
      console.warn("SessionStorage není dostupný, používám pouze paměť")
    }
  },
  getUserId() {
    if (this.userId) return this.userId
    try {
      const stored = sessionStorage.getItem("userId")
      if (stored) {
        this.userId = stored
        return stored
      }
    } catch (e) {
      console.warn("SessionStorage není dostupný")
    }
    return null
  },
  clearUserId() {
    this.userId = null
    try {
      sessionStorage.removeItem("userId")
    } catch (e) {}
  },
}

// --- Inicializace ---
document.addEventListener("DOMContentLoaded", () => {
  const startForm = document.getElementById("startForm")
  if (startForm) {
    startForm.addEventListener("submit", handleStartGame)
  } else if (document.getElementById("testArea")) {
    userId = sessionData.getUserId()
    loadGameState()
  }

  if (reelStrips.length > 0) {
    createSymbols()
    initializePositions()
  }
})

function createSymbols() {
  reelStrips.forEach((strip) => {
    strip.innerHTML = ""
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

function initializePositions() {
  reelStrips.forEach((strip) => {
    strip.style.top = "0px"
    strip.style.transition = "none"
  })
}

// --- START GAME ---
async function handleStartGame(e) {
  e.preventDefault()
  const usernameInput = document.getElementById("usernameInput")
  const errorMessage = document.getElementById("errorMessage")
  const username = usernameInput.value.trim()

  if (!username) {
    errorMessage.textContent = "Prosím zadejte jméno."
    return
  }

  if (username.length > 50) {
    errorMessage.textContent = "Jméno je příliš dlouhé (max 50 znaků)."
    return
  }

  errorMessage.textContent = "Načítám..."
  errorMessage.style.color = "blue"

  try {
    const data = await window.API.startGame(username)

    if (data.success && data.user) {
      sessionData.setUserId(data.user.id)
      window.location.href = "test.html"
    } else {
      errorMessage.style.color = "red"
      errorMessage.textContent = data.error || "Chyba při startu hry."
    }
  } catch (error) {
    errorMessage.style.color = "red"
    errorMessage.textContent = "Chyba komunikace: " + error.message
    console.error("Start game error:", error)
  }
}

// --- Logika Testu (test.html) ---
async function loadGameState() {
  userId = sessionData.getUserId()

  if (!userId && window.location.pathname.endsWith("test.html")) {
    console.warn("Chybí userId, redirect na index")
    setTimeout(() => (window.location.href = "index.html"), 100)
    return
  }

  if (optionsContainer) optionsContainer.style.display = "block"
  if (spinResultArea) spinResultArea.style.display = "none"

  try {
    const data = await window.API.getGameState(userId)

    if (data.success) {
      currentUser = data.username
      balance = data.score
      freeSpins = data.freeSpins
      canSpin = data.canSpin

      updateUI()
      displayQuestion(data)
    } else {
      if (userDisplayElement) {
        userDisplayElement.textContent = data.error || "Chyba načítání stavu"
      }

      if (data.error && data.error.includes("nenalezen")) {
        setTimeout(() => (window.location.href = "index.html"), 2000)
      }
    }
  } catch (error) {
    if (userDisplayElement) {
      userDisplayElement.textContent = "Chyba komunikace: " + error.message
    }
    console.error("Load game state error:", error)
  }
}

function updateUI() {
  if (userDisplayElement) userDisplayElement.textContent = currentUser || "Neznámý hráč"
  if (balanceElement) balanceElement.textContent = balance
  if (freeSpinsCountElement) freeSpinsCountElement.textContent = freeSpins

  if (reelsContainer) {
    reelsContainer.style.cursor = canSpin ? "pointer" : "not-allowed"
    reelsContainer.style.opacity = canSpin ? "1" : "0.6"
  }

  if (instructionsElement) {
    if (isSpinning) {
      instructionsElement.textContent = "Klikněte pro zastavení válců."
    } else if (canSpin) {
      instructionsElement.textContent = "Správně! Klikněte (nebo mezerník) pro točení!"
    } else {
      instructionsElement.textContent = "Odpověz na otázku."
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function displayQuestion(data) {
  const q = data.question

  if (!optionsContainer || !questionContainer) return

  optionsContainer.innerHTML = ""
  questionContainer.style.display = "block"

  if (q.text === "TEST DOKONČEN!") {
    questionContainer.innerHTML = `
            <div class="question-text" style="color: var(--highlight-color);">
                <h2>🎉 TEST DOKONČEN!</h2>
                <p>Gratulujeme! Tvé konečné skóre je <strong>${balance} bodů</strong>.</p>
                <p>Přesměrování na výsledkovou tabuli...</p>
            </div>
        `
    if (instructionsElement) {
      instructionsElement.textContent = "Test dokončen!"
    }
    setTimeout(() => (window.location.href = "leaderboard.html"), 2000)
    return
  }

  if (q.text === "GAME OVER" || balance <= 0) {
    questionContainer.innerHTML = `
            <div class="question-text" style="color: red;">
                <h2>💀 GAME OVER</h2>
                <p>Došly ti body! Tvé konečné skóre je <strong>${balance} bodů</strong>.</p>
                <p>Přesměrování na výsledkovou tabuli...</p>
            </div>
        `
    if (instructionsElement) {
      instructionsElement.textContent = "Hra skončila."
    }
    if (reelsContainer) {
      reelsContainer.style.cursor = "not-allowed"
    }
    setTimeout(() => (window.location.href = "leaderboard.html"), 3000)
    return
  }

  currentQuestionId = q.id
  const questionTextElement = questionContainer.querySelector(".question-text")
  if (questionTextElement) {
    questionTextElement.innerHTML = `Otázka ${data.questionIndex + 1}/${data.maxQuestions}: ${escapeHtml(q.text)}`
  }

  for (const key in q.options) {
    const button = document.createElement("button")
    button.textContent = `${key}: ${q.options[key]}`
    button.dataset.answer = key
    button.className = "option-button"
    button.onclick = () => submitAnswer(key)
    optionsContainer.appendChild(button)
  }
}

async function submitAnswer(answer) {
  if (canSpin || isSpinning) {
    console.warn("Nelze odpovídat během spinu")
    return
  }

  const buttons = optionsContainer.querySelectorAll("button")
  buttons.forEach((btn) => (btn.disabled = true))

  if (optionsContainer) optionsContainer.style.display = "none"
  if (spinResultArea) spinResultArea.style.display = "block"

  try {
    const data = await window.API.submitAnswer(userId, answer, currentQuestionId)

    if (data.success) {
      if (data.isCorrect) {
        canSpin = true
        updateUI()
        if (resultHeadline) {
          resultHeadline.style.color = "var(--highlight-color)"
          resultHeadline.textContent = "✅ SPRÁVNĚ!"
        }
        if (resultDetail) {
          resultDetail.textContent = "Klikněte 3x (nebo 3x mezerník) na automat pro zatočení a získání bodů!"
        }
      } else {
        balance = data.newScore
        updateUI()
        if (resultHeadline) {
          resultHeadline.style.color = "red"
          resultHeadline.textContent = "❌ ŠPATNĚ!"
        }
        if (resultDetail) {
          resultDetail.textContent = `Ztrácíš 1 bod. Zbývá bodů: ${balance}. Přecházím na další otázku...`
        }

        if (balance > 0) {
          setTimeout(loadGameState, 2500)
        } else {
          setTimeout(loadGameState, 500)
        }
      }
    } else {
      throw new Error(data.error || "Neznámá chyba")
    }
  } catch (error) {
    if (resultHeadline) {
      resultHeadline.style.color = "red"
      resultHeadline.textContent = "⚠️ CHYBA"
    }
    if (resultDetail) {
      resultDetail.textContent = "Komunikační chyba: " + error.message
    }

    setTimeout(() => {
      if (optionsContainer) optionsContainer.style.display = "block"
      if (spinResultArea) spinResultArea.style.display = "none"
      buttons.forEach((btn) => (btn.disabled = false))
    }, 2000)

    console.error("Submit answer error:", error)
  }
}

// --- Logika Automatu ---
const spinSpeed = 20
const decelerationDuration = 1500

function generateCombination() {
  const combination = []
  for (let i = 0; i < 3; i++) {
    combination.push(Math.floor(Math.random() * symbols.length))
  }
  return combination
}

function calculateWin(combination) {
  const [a, b, c] = combination

  if (a === b && b === c) {
    const symbolIndex = a
    let win = 0
    let addFreeSpins = 0
    let message = ""

    switch (symbolIndex) {
      case 0:
        win = 5
        message = "💰 Tři peníze! +5 bodů!"
        break
      case 1:
        win = 3
        addFreeSpins = 1
        message = "⭐ Tři hvězdy! +3 body a +1 volné zatočení!"
        break
      case 2:
        win = 2
        message = "🍒 Tři třešně! +2 body!"
        break
      case 3:
        win = 2
        message = "🍑 Tři švestky! +2 body!"
        break
      case 4:
        win = 2
        message = "🍇 Tři hrozny! +2 body!"
        break
      case 5:
        win = 4
        message = "🎰 Tři rulety! +4 body!"
        break
    }

    return { win, addFreeSpins, message }
  }

  if (a === b || b === c || a === c) {
    return { win: 1, addFreeSpins: 0, message: "🎯 Dva stejné symboly! +1 bod!" }
  }

  return { win: 0, addFreeSpins: 0, message: "😕 Bohužel žádná výhra. Zkus to znovu!" }
}

async function saveSpinResult(points, addFreeSpins) {
  try {
    const data = await window.API.saveSpinResult(userId, points, addFreeSpins)

    if (data.success) {
      balance = data.newScore
      freeSpins += addFreeSpins
      updateUI()

      setTimeout(() => {
        loadGameState()
      }, 3000)
    } else {
      throw new Error(data.error || "Nepodařilo se uložit výsledek")
    }
  } catch (error) {
    console.error("Save spin result error:", error)
    if (resultHeadline) resultHeadline.textContent = "⚠️ CHYBA"
    if (resultDetail) resultDetail.textContent = "Komunikační chyba: " + error.message
  }
}

function spin(reelIndex) {
  if (!spinningReels[reelIndex]) return

  const strip = reelStrips[reelIndex]
  const symbolsPerSet = symbols.length
  const totalStripHeight = SYMBOL_HEIGHT * symbolsPerSet * 4

  let currentSpeed = speed
  if (reelIndex === 0 && speed < spinSpeed) {
    speed += 0.5
    currentSpeed = speed
  } else if (reelIndex > 0) {
    currentSpeed = spinSpeed
  }

  const currentTop = Number.parseFloat(strip.style.top) || 0
  let newTop = currentTop + currentSpeed * spinDirection

  if (Math.abs(newTop) >= totalStripHeight) {
    newTop = 0
  }

  strip.style.top = `${newTop}px`
  spinIntervals[reelIndex] = requestAnimationFrame(() => spin(reelIndex))
}

function stopReel(reelIndex) {
  if (!spinningReels[reelIndex]) return

  spinningReels[reelIndex] = false
  cancelAnimationFrame(spinIntervals[reelIndex])

  const strip = reelStrips[reelIndex]

  const targetSymbolIndex = nextCombination[reelIndex]
  const setIndex = 1

  const targetPosition = -(SYMBOL_HEIGHT * (setIndex * symbols.length + targetSymbolIndex))

  strip.style.transition = `top ${decelerationDuration / 1000}s cubic-bezier(0.25, 0.1, 0.25, 1)`
  strip.style.top = `${targetPosition}px`

  if (reelIndex === 2) {
    setTimeout(() => {
      const result = calculateWin(nextCombination)

      if (resultHeadline) {
        resultHeadline.style.color = result.win > 0 ? "var(--highlight-color)" : "orange"
        resultHeadline.textContent = `🎰 VÝSLEDEK: +${result.win} bodů!`
      }

      if (resultDetail) {
        resultDetail.innerHTML = `<strong>${escapeHtml(result.message)}</strong>`
      }

      speed = 0
      isSpinning = false
      currentReel = 0

      saveSpinResult(result.win, result.addFreeSpins)
    }, decelerationDuration + 200)
  }
}

function activate() {
  if (!canSpin && !isSpinning) {
    if (instructionsElement) {
      instructionsElement.textContent = "⚠️ Nejdříve správně odpověz na otázku!"
    }
    return
  }

  if (!isSpinning && currentReel === 0 && canSpin) {
    if (instructionsElement) {
      instructionsElement.textContent = "🎰 Válec 1 se točí... Klikněte pro zastavení."
    }

    if (freeSpins > 0) {
      freeSpins--
    }

    nextCombination = generateCombination()
    isSpinning = true
    spinningReels = [true, true, true]
    currentReel = 0
    canSpin = false

    reelStrips.forEach((strip, index) => {
      strip.style.transition = "none"
      strip.style.top = "0px"
      spin(index)
    })
    updateUI()
  } else if (isSpinning) {
    if (currentReel < 3) {
      stopReel(currentReel)
      currentReel++

      if (instructionsElement) {
        if (currentReel < 3) {
          instructionsElement.textContent = `🎰 Válec ${currentReel + 1} se točí... Klikněte pro zastavení.`
        } else {
          instructionsElement.textContent = "⏳ Čekám na vyhodnocení výhry..."
        }
      }
    }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault()
    activate()
  }
})
