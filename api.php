<?php
header('Content-Type: application/json');

// Konstanta pro počáteční body a počet otázek
const INITIAL_SCORE = 10;
const QUESTIONS_PER_TEST = 5; 

// --- JSON Helpers (s jednoduchou zamykací logikou pro bezpečnost) ---

function readUsers() {
    $usersData = [];
    $fp = fopen('users.json', 'r');
    if ($fp) {
        if (flock($fp, LOCK_SH)) { // shared lock
            $contents = stream_get_contents($fp);
            $usersData = json_decode($contents, true)['users'] ?? [];
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
    return $usersData;
}

function writeUsers($users) {
    $result = false;
    $fp = fopen('users.json', 'w');
    if ($fp) {
        if (flock($fp, LOCK_EX)) { // exclusive lock
            $result = file_put_contents('users.json', json_encode(['users' => array_values($users)], JSON_PRETTY_PRINT));
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
    return $result !== false;
}

function readQuestions() {
    $data = file_get_contents('questions.json');
    return json_decode($data, true)['questions'] ?? [];
}

function generateUniqueId($username) {
    return hash('sha256', $username . time() . rand(0, 999));
}

// --- Hlavní Logika API ---

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';
$userId = $data['userId'] ?? '';

switch ($action) {
    // --- AKCE PRO UŽIVATELE/HRU ---
    case 'start_game':
        $username = trim($data['username'] ?? '');
        if (empty($username)) {
            echo json_encode(['success' => false, 'error' => 'Jméno je povinné.']);
            exit;
        }

        $users = readUsers();
        $userFound = null;

        foreach ($users as $key => $user) {
            if ($user['username'] === $username) {
                // Resetování stavu, pokud test skončil nebo se spouští nová hra
                $allQuestions = readQuestions();
                $questionIds = array_column($allQuestions, 'id');
                shuffle($questionIds);
                
                $users[$key]['score'] = INITIAL_SCORE;
                $users[$key]['freeSpins'] = 0;
                $users[$key]['questions_set'] = array_slice($questionIds, 0, QUESTIONS_PER_TEST);
                $users[$key]['current_question_index'] = 0;
                $users[$key]['can_spin'] = false;
                
                $userFound = $users[$key];
                break;
            }
        }

        if (!$userFound) {
            $allQuestions = readQuestions();
            $questionIds = array_column($allQuestions, 'id');
            shuffle($questionIds);
            
            $newUser = [
                'id' => generateUniqueId($username),
                'username' => $username,
                'score' => INITIAL_SCORE, // Default 10 points
                'freeSpins' => 0,
                'questions_set' => array_slice($questionIds, 0, QUESTIONS_PER_TEST),
                'current_question_index' => 0,
                'can_spin' => false
            ];
            $users[] = $newUser;
            $userFound = $newUser;
        }
        
        writeUsers($users);
        echo json_encode(['success' => true, 'user' => $userFound]);
        break;

    case 'get_game_state':
        // Zjednodušeno pro přehlednost...
        $users = readUsers();
        $currentUser = null;
        foreach ($users as $user) {
            if ($user['id'] === $userId) {
                $currentUser = $user;
                break;
            }
        }

        if (!$currentUser) {
            echo json_encode(['success' => false, 'error' => 'Uživatel nenalezen.']);
            exit;
        }
        
        $allQuestions = readQuestions();
        $qSet = $currentUser['questions_set'];
        $qIndex = $currentUser['current_question_index'];
        $maxQuestions = QUESTIONS_PER_TEST;
        $currentQuestion = null;
        
        if ($qIndex < $maxQuestions && $currentUser['score'] > 0) {
            $currentQuestionId = $qSet[$qIndex];
            foreach ($allQuestions as $q) {
                if ($q['id'] == $currentQuestionId) {
                    $currentQuestion = ['id' => $q['id'], 'text' => $q['text'], 'options' => $q['options']];
                    break;
                }
            }
        } else {
            // Test je hotový nebo GAME OVER
            $currentQuestion = ['text' => ($currentUser['score'] <= 0 ? 'GAME OVER' : 'TEST DOKONČEN!'), 'options' => []];
        }

        echo json_encode([
            'success' => true,
            'username' => $currentUser['username'],
            'score' => $currentUser['score'],
            'freeSpins' => $currentUser['freeSpins'],
            'canSpin' => $currentUser['can_spin'],
            'question' => $currentQuestion,
            'questionIndex' => $qIndex,
            'maxQuestions' => $maxQuestions
        ]);
        break;
    
    case 'submit_answer':
        $answer = $data['answer'] ?? '';
        $questionId = $data['questionId'] ?? '';
        
        $users = readUsers();
        $allQuestions = readQuestions();
        $userKey = -1;

        foreach ($users as $key => $user) {
            if ($user['id'] === $userId) {
                $userKey = $key;
                break;
            }
        }

        if ($userKey === -1 || $users[$userKey]['can_spin']) {
            echo json_encode(['success' => false, 'error' => 'Chybný stav hry.']);
            exit;
        }
        
        $correctAnswer = null;
        foreach ($allQuestions as $q) {
            if ($q['id'] == $questionId) {
                $correctAnswer = $q['correct'];
                break;
            }
        }
        
        $isCorrect = ($answer === $correctAnswer);

        if ($isCorrect) {
            $users[$userKey]['can_spin'] = true;
            writeUsers($users);
            echo json_encode(['success' => true, 'isCorrect' => true, 'canSpin' => true]);
        } else {
            // Špatná odpověď: -1 bod a přesun na další otázku
            $users[$userKey]['score'] = max(0, $users[$userKey]['score'] - 1);
            $users[$userKey]['current_question_index']++;
            $users[$userKey]['can_spin'] = false;
            writeUsers($users);
            echo json_encode(['success' => true, 'isCorrect' => false, 'newScore' => $users[$userKey]['score']]);
        }
        break;

    case 'save_spin_result':
        $points = $data['points'] ?? 0;
        $freeSpinsAdd = $data['freeSpinsAdd'] ?? 0;
        
        $users = readUsers();
        $userKey = -1;
        foreach ($users as $key => $user) {
            if ($user['id'] === $userId) {
                $userKey = $key;
                break;
            }
        }

        if ($userKey === -1 || !$users[$userKey]['can_spin']) {
            echo json_encode(['success' => false, 'error' => 'Uživatel nenalezen nebo neměl povoleno točit.']);
            exit;
        }

        // Uložení výsledků a posun na další otázku
        $users[$userKey]['score'] = $users[$userKey]['score'] + $points;
        $users[$userKey]['freeSpins'] += $freeSpinsAdd;
        $users[$userKey]['current_question_index']++;
        $users[$userKey]['can_spin'] = false;
        
        writeUsers($users);
        echo json_encode(['success' => true, 'newScore' => $users[$userKey]['score']]);
        break;

    // --- AKCE PRO LEADERBOARD ---
    case 'get_leaderboard':
        $users = readUsers();
        
        // Seřazení uživatelů podle skóre
        usort($users, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });
        
        $leaderboard = array_map(function($user) use ($maxQuestions) {
            return [
                'username' => $user['username'],
                'score' => $user['score'],
                'progress' => ($user['current_question_index'] >= $maxQuestions) ? 'Dokončeno' : 'Hraje'
            ];
        }, $users);

        echo json_encode(['success' => true, 'leaderboard' => $leaderboard]);
        break;

    // --- AKCE PRO ADMIN (Bez ochrany heslem) ---
    case 'admin_get_users':
        $users = readUsers();
        echo json_encode(['success' => true, 'users' => array_values($users)]);
        break;

    case 'admin_kick_user':
        $targetUserId = $data['targetUserId'] ?? '';
        $users = readUsers();
        $users = array_filter($users, function($user) use ($targetUserId) {
            return $user['id'] !== $targetUserId;
        });
        writeUsers($users);
        echo json_encode(['success' => true, 'message' => 'Uživatel byl odstraněn.']);
        break;

    case 'admin_reset_user_progress':
        $targetUserId = $data['targetUserId'] ?? '';
        $users = readUsers();
        $userKey = -1;
        foreach ($users as $key => $user) {
            if ($user['id'] === $targetUserId) {
                $userKey = $key;
                break;
            }
        }

        if ($userKey !== -1) {
            $allQuestions = readQuestions();
            $questionIds = array_column($allQuestions, 'id');
            shuffle($questionIds);
            
            $users[$userKey]['score'] = INITIAL_SCORE;
            $users[$userKey]['freeSpins'] = 0;
            $users[$userKey]['questions_set'] = array_slice($questionIds, 0, QUESTIONS_PER_TEST);
            $users[$userKey]['current_question_index'] = 0;
            $users[$userKey]['can_spin'] = false;
            
            writeUsers($users);
            echo json_encode(['success' => true, 'message' => 'Progres uživatele byl resetován.']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Uživatel nenalezen.']);
        }
        break;

    case 'admin_kick_all':
        writeUsers([]);
        echo json_encode(['success' => true, 'message' => 'Všichni uživatelé byli odstraněni.']);
        break;

    case 'admin_reset_all_progress':
        $users = readUsers();
        $allQuestions = readQuestions();
        $questionIds = array_column($allQuestions, 'id');
        
        foreach ($users as $key => $user) {
            shuffle($questionIds);
            $users[$key]['score'] = INITIAL_SCORE;
            $users[$key]['freeSpins'] = 0;
            $users[$key]['questions_set'] = array_slice($questionIds, 0, QUESTIONS_PER_TEST);
            $users[$key]['current_question_index'] = 0;
            $users[$key]['can_spin'] = false;
        }
        writeUsers($users);
        echo json_encode(['success' => true, 'message' => 'Progres všech uživatelů byl resetován.']);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Neplatná akce API.']);
}
?>