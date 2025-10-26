document.addEventListener('DOMContentLoaded', loadAdminUsers);

const userTableBody = document.getElementById('userTableBody');
const adminMessage = document.getElementById('adminMessage');

async function loadAdminUsers() {
    adminMessage.textContent = 'Načítám data...';
    userTableBody.innerHTML = '<tr><td colspan="5">Načítám uživatele...</td></tr>';

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'admin_get_users' })
        });
        const data = await response.json();

        if (data.success && data.users) {
            adminMessage.textContent = 'Seznam uživatelů načten.';
            renderUserTable(data.users);
        } else {
            adminMessage.textContent = 'Chyba při načítání uživatelů.';
            userTableBody.innerHTML = '<tr><td colspan="5">Chyba při načítání dat.</td></tr>';
        }
    } catch (error) {
        adminMessage.textContent = 'Chyba komunikace se serverem.';
    }
}

function renderUserTable(users) {
    userTableBody.innerHTML = '';
    if (users.length === 0) {
        userTableBody.innerHTML = '<tr><td colspan="5">Žádní uživatelé v databázi.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        const totalQuestions = user.questions_set ? user.questions_set.length : 0;
        const questionStatus = `${user.current_question_index}/${totalQuestions}`;

        tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.score}</td>
            <td>${questionStatus}</td>
            <td>${user.freeSpins}</td>
            <td>
                <button onclick="adminAction('admin_reset_user_progress', '${user.id}', 'Opravdu chcete resetovat progres uživatele ${user.username}?')">Reset Progres</button>
                <button onclick="adminAction('admin_kick_user', '${user.id}', 'Opravdu chcete odstranit uživatele ${user.username}?')" style="background: #dc3545;">Odstranit</button>
            </td>
        `;
        userTableBody.appendChild(tr);
    });
}

async function adminAction(action, targetUserId, confirmationMessage) {
    if (!confirm(confirmationMessage)) {
        return;
    }

    adminMessage.textContent = 'Provádím akci...';

    let requestBody = { action };
    if (targetUserId) {
        requestBody.targetUserId = targetUserId;
    }

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();

        if (data.success) {
            adminMessage.textContent = `Akce proběhla úspěšně: ${data.message || 'Data aktualizována.'}`;
            loadAdminUsers(); 
        } else {
            adminMessage.textContent = `Chyba akce: ${data.error || 'Neznámá chyba.'}`;
        }
    } catch (error) {
        adminMessage.textContent = 'Chyba komunikace se serverem.';
    }
}