document.addEventListener("DOMContentLoaded", loadAdminUsers)

function getAdminPassword() {
  const passwordInput = document.getElementById("adminPassword")
  if (!passwordInput) {
    alert("Chyba: Pole pro heslo nebylo nalezeno.")
    return null
  }
  const password = passwordInput.value.trim()
  if (!password) {
    alert("Prosím zadejte admin heslo.")
    return null
  }
  return password
}

const userTableBody = document.getElementById("userTableBody")
const adminMessage = document.getElementById("adminMessage")

async function loadAdminUsers() {
  const password = getAdminPassword()
  if (!password) return

  adminMessage.textContent = "Načítám data..."
  userTableBody.innerHTML = '<tr><td colspan="5">Načítám uživatele...</td></tr>'

  try {
    const data = await window.API.adminGetUsers(password)

    if (data.success && data.users) {
      adminMessage.textContent = "Seznam uživatelů načten."
      adminMessage.style.color = "green"
      renderUserTable(data.users)
    } else {
      adminMessage.textContent = data.error || "Chyba při načítání uživatelů."
      adminMessage.style.color = "red"
      userTableBody.innerHTML = '<tr><td colspan="5">Chyba při načítání dat.</td></tr>'
    }
  } catch (error) {
    adminMessage.textContent = "Chyba komunikace: " + error.message
    adminMessage.style.color = "red"
  }
}

function renderUserTable(users) {
  userTableBody.innerHTML = ""
  if (users.length === 0) {
    userTableBody.innerHTML = '<tr><td colspan="5">Žádní uživatelé v databázi.</td></tr>'
    return
  }

  users.forEach((user) => {
    const tr = document.createElement("tr")
    const totalQuestions = user.questions_set ? user.questions_set.length : 0
    const questionStatus = `${user.current_question_index}/${totalQuestions}`

    tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.score}</td>
            <td>${questionStatus}</td>
            <td>${user.freeSpins}</td>
            <td>
                <button onclick="adminAction('admin_reset_user_progress', '${user.id}', 'Opravdu chcete resetovat progres uživatele ${user.username}?')">Reset Progres</button>
                <button onclick="adminAction('admin_kick_user', '${user.id}', 'Opravdu chcete odstranit uživatele ${user.username}?')" style="background: #dc3545;">Odstranit</button>
            </td>
        `
    userTableBody.appendChild(tr)
  })
}

async function adminAction(action, targetUserId, confirmationMessage) {
  if (!confirm(confirmationMessage)) {
    return
  }

  const password = getAdminPassword()
  if (!password) return

  adminMessage.textContent = "Provádím akci..."
  adminMessage.style.color = "blue"

  try {
    let data

    switch (action) {
      case "admin_reset_user_progress":
        data = await window.API.adminResetUserProgress(password, targetUserId)
        break
      case "admin_kick_user":
        data = await window.API.adminKickUser(password, targetUserId)
        break
      case "admin_kick_all":
        data = await window.API.adminKickAll(password)
        break
      case "admin_reset_all_progress":
        data = await window.API.adminResetAllProgress(password)
        break
      default:
        throw new Error("Neznámá akce")
    }

    if (data.success) {
      adminMessage.textContent = `Akce proběhla úspěšně: ${data.message || "Data aktualizována."}`
      adminMessage.style.color = "green"
      loadAdminUsers()
    } else {
      adminMessage.textContent = `Chyba akce: ${data.error || "Neznámá chyba."}`
      adminMessage.style.color = "red"
    }
  } catch (error) {
    adminMessage.textContent = "Chyba komunikace: " + error.message
    adminMessage.style.color = "red"
  }
}
