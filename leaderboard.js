document.addEventListener("DOMContentLoaded", loadLeaderboard)

async function loadLeaderboard() {
  const listElement = document.getElementById("leaderboardList")
  listElement.innerHTML = "<li>Načítám data...</li>"

  try {
    const response = await fetch("api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_leaderboard" }),
    })

    if (!response.ok) {
      throw new Error("Server error: " + response.status)
    }

    const data = await response.json()

    if (data.success && data.leaderboard) {
      listElement.innerHTML = ""
      if (data.leaderboard.length === 0) {
        listElement.innerHTML = "<li>Zatím žádní hráči.</li>"
        return
      }
      data.leaderboard.forEach((user, index) => {
        const li = document.createElement("li")
        const place = index + 1

        li.innerHTML = `
                    <span class="place">${place}.</span>
                    <span class="username">${user.username} (${user.progress})</span>
                    <span class="score">${user.score} bodů</span>
                `
        listElement.appendChild(li)
      })
    } else {
      listElement.innerHTML = "<li>Chyba při načítání žebříčku.</li>"
    }
  } catch (error) {
    console.error("Chyba komunikace při načítání žebříčku:", error)
    listElement.innerHTML = "<li>Chyba komunikace se serverem.</li>"
  }
}
