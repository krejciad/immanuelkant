// Konstanty
const INITIAL_SCORE = 10
const QUESTIONS_PER_TEST = 5
const ADMIN_PASSWORD = "admin123"

// Storage klíče
const STORAGE_KEYS = {
  USERS: "casino_users",
  QUESTIONS: "casino_questions",
  INITIALIZED: "casino_initialized",
}

let initializationPromise = null

// Pomocné funkce pro localStorage
const Storage = {
  isInitialized() {
    return localStorage.getItem(STORAGE_KEYS.INITIALIZED) === "true"
  },

  markInitialized() {
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true")
  },

  // Načtení uživatelů
  getUsers() {
    const data = localStorage.getItem(STORAGE_KEYS.USERS)
    return data ? JSON.parse(data) : []
  },

  // Uložení uživatelů
  setUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
  },

  // Načtení otázek
  getQuestions() {
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS)
    return data ? JSON.parse(data) : []
  },

  setQuestions(questions) {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions))
  },

  async initializeQuestions() {
    try {
      console.log("[v0] Načítám otázky z questions.json...")
      const response = await fetch("questions.json")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log("[v0] Načteno otázek:", data.questions.length)
      this.setQuestions(data.questions)
      this.markInitialized()
      return true
    } catch (error) {
      console.error("[v0] Chyba při načítání otázek:", error)
      return false
    }
  },

  async ensureInitialized() {
    if (this.isInitialized()) {
      console.log("[v0] Data již inicializována")
      return true
    }

    if (initializationPromise) {
      console.log("[v0] Čekám na probíhající inicializaci...")
      return await initializationPromise
    }

    console.log("[v0] Spouštím inicializaci...")
    initializationPromise = this.initializeQuestions()
    const result = await initializationPromise
    initializationPromise = null
    return result
  },

  // Generování unikátního ID
  generateId(username) {
    return `${username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
}

// API funkce (náhrada za PHP backend)
const API = {
  async startGame(username) {
    console.log("[v0] startGame volána pro:", username)

    // Zajistit inicializaci
    const initialized = await Storage.ensureInitialized()
    if (!initialized) {
      return { success: false, error: "Nepodařilo se načíst otázky." }
    }

    if (!username || username.length > 50) {
      return { success: false, error: "Neplatné jméno." }
    }

    const users = Storage.getUsers()
    const questions = Storage.getQuestions()

    console.log("[v0] Počet otázek:", questions.length)
    console.log("[v0] Počet uživatelů:", users.length)

    if (questions.length < QUESTIONS_PER_TEST) {
      return {
        success: false,
        error: `Nedostatek otázek (${questions.length}/${QUESTIONS_PER_TEST}).`,
      }
    }

    let user = users.find((u) => u.username === username)

    if (user) {
      // Reset existujícího uživatele
      const questionIds = questions.map((q) => q.id)
      this.shuffleArray(questionIds)

      user.score = INITIAL_SCORE
      user.freeSpins = 0
      user.questions_set = questionIds.slice(0, QUESTIONS_PER_TEST)
      user.current_question_index = 0
      user.can_spin = false
      console.log("[v0] Reset existujícího uživatele:", user.username)
    } else {
      // Vytvoření nového uživatele
      const questionIds = questions.map((q) => q.id)
      this.shuffleArray(questionIds)

      user = {
        id: Storage.generateId(username),
        username: username,
        score: INITIAL_SCORE,
        freeSpins: 0,
        questions_set: questionIds.slice(0, QUESTIONS_PER_TEST),
        current_question_index: 0,
        can_spin: false,
      }
      users.push(user)
      console.log("[v0] Vytvořen nový uživatel:", user.username, "ID:", user.id)
    }

    Storage.setUsers(users)
    return { success: true, user: user }
  },

  async getGameState(userId) {
    console.log("[v0] getGameState volána pro userId:", userId)

    // Zajistit inicializaci
    const initialized = await Storage.ensureInitialized()
    if (!initialized) {
      return { success: false, error: "Nepodařilo se načíst otázky." }
    }

    const users = Storage.getUsers()
    const user = users.find((u) => u.id === userId)

    if (!user) {
      console.log("[v0] Uživatel nenalezen, userId:", userId)
      return { success: false, error: "Uživatel nenalezen." }
    }

    console.log("[v0] Nalezen uživatel:", user.username, "Score:", user.score)

    const questions = Storage.getQuestions()
    const qIndex = user.current_question_index
    let currentQuestion = null

    if (qIndex < QUESTIONS_PER_TEST && user.score > 0) {
      const questionId = user.questions_set[qIndex]
      const q = questions.find((question) => question.id === questionId)

      if (q) {
        currentQuestion = {
          id: q.id,
          text: q.text,
          options: q.options,
        }
        console.log("[v0] Načtena otázka:", q.id, q.text.substring(0, 50))
      } else {
        console.log("[v0] Otázka nenalezena, ID:", questionId)
      }
    } else {
      currentQuestion = {
        text: user.score <= 0 ? "GAME OVER" : "TEST DOKONČEN!",
        options: [],
      }
      console.log("[v0] Konec hry:", currentQuestion.text)
    }

    return {
      success: true,
      username: user.username,
      score: user.score,
      freeSpins: user.freeSpins,
      canSpin: user.can_spin,
      question: currentQuestion,
      questionIndex: qIndex,
      maxQuestions: QUESTIONS_PER_TEST,
    }
  },

  // Odeslání odpovědi
  async submitAnswer(userId, answer, questionId) {
    const users = Storage.getUsers()
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return { success: false, error: "Uživatel nenalezen." }
    }

    const user = users[userIndex]

    if (user.can_spin) {
      return { success: false, error: "Chybný stav hry - již můžete točit." }
    }

    const questions = Storage.getQuestions()
    const question = questions.find((q) => q.id === questionId)

    if (!question) {
      return { success: false, error: "Otázka nenalezena." }
    }

    const isCorrect = answer === question.correct

    if (isCorrect) {
      users[userIndex].can_spin = true
      Storage.setUsers(users)
      return { success: true, isCorrect: true, canSpin: true }
    } else {
      users[userIndex].score = Math.max(0, users[userIndex].score - 1)
      users[userIndex].current_question_index++
      users[userIndex].can_spin = false
      Storage.setUsers(users)
      return { success: true, isCorrect: false, newScore: users[userIndex].score }
    }
  },

  // Uložení výsledku točení
  async saveSpinResult(userId, points, freeSpinsAdd) {
    const users = Storage.getUsers()
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return { success: false, error: "Uživatel nenalezen." }
    }

    if (!users[userIndex].can_spin) {
      return { success: false, error: "Uživatel neměl povoleno točit." }
    }

    users[userIndex].score += points
    users[userIndex].freeSpins += freeSpinsAdd
    users[userIndex].current_question_index++
    users[userIndex].can_spin = false

    Storage.setUsers(users)
    return { success: true, newScore: users[userIndex].score }
  },

  // Získání leaderboardu
  async getLeaderboard() {
    const users = Storage.getUsers()

    users.sort((a, b) => b.score - a.score)

    const leaderboard = users.map((user) => ({
      username: user.username,
      score: user.score,
      progress: user.current_question_index >= QUESTIONS_PER_TEST ? "Dokončeno" : "Hraje",
    }))

    return { success: true, leaderboard: leaderboard }
  },

  // Admin: Získání všech uživatelů
  async adminGetUsers(password) {
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: "Neplatné heslo." }
    }

    const users = Storage.getUsers()
    return { success: true, users: users }
  },

  // Admin: Odstranění uživatele
  async adminKickUser(password, targetUserId) {
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: "Neplatné heslo." }
    }

    const users = Storage.getUsers()
    const filtered = users.filter((u) => u.id !== targetUserId)
    Storage.setUsers(filtered)
    return { success: true, message: "Uživatel byl odstraněn." }
  },

  // Admin: Reset progresu uživatele
  async adminResetUserProgress(password, targetUserId) {
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: "Neplatné heslo." }
    }

    const users = Storage.getUsers()
    const userIndex = users.findIndex((u) => u.id === targetUserId)

    if (userIndex === -1) {
      return { success: false, error: "Uživatel nenalezen." }
    }

    const questions = Storage.getQuestions()
    const questionIds = questions.map((q) => q.id)
    this.shuffleArray(questionIds)

    users[userIndex].score = INITIAL_SCORE
    users[userIndex].freeSpins = 0
    users[userIndex].questions_set = questionIds.slice(0, QUESTIONS_PER_TEST)
    users[userIndex].current_question_index = 0
    users[userIndex].can_spin = false

    Storage.setUsers(users)
    return { success: true, message: "Progres uživatele byl resetován." }
  },

  // Admin: Odstranění všech uživatelů
  async adminKickAll(password) {
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: "Neplatné heslo." }
    }

    Storage.setUsers([])
    return { success: true, message: "Všichni uživatelé byli odstraněni." }
  },

  // Admin: Reset progresu všech uživatelů
  async adminResetAllProgress(password) {
    if (password !== ADMIN_PASSWORD) {
      return { success: false, error: "Neplatné heslo." }
    }

    const users = Storage.getUsers()
    const questions = Storage.getQuestions()
    const questionIds = questions.map((q) => q.id)

    users.forEach((user) => {
      const shuffled = [...questionIds]
      this.shuffleArray(shuffled)

      user.score = INITIAL_SCORE
      user.freeSpins = 0
      user.questions_set = shuffled.slice(0, QUESTIONS_PER_TEST)
      user.current_question_index = 0
      user.can_spin = false
    })

    Storage.setUsers(users)
    return { success: true, message: "Progres všech uživatelů byl resetován." }
  },

  // Pomocná funkce pro míchání pole
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  },
}

console.log("[v0] storage.js načten, spouštím inicializaci...")
Storage.ensureInitialized().then((success) => {
  if (success) {
    console.log("[v0] Inicializace dokončena úspěšně")
  } else {
    console.error("[v0] Inicializace selhala")
  }
})

// Export pro použití v ostatních souborech
window.API = API
window.Storage = Storage
