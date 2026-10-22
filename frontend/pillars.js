'use strict';

/**
 * Cerdas Cermat - Pillars A, B, and C Engine
 * Pillar A: Adaptive Student Flow & Placement Test
 * Pillar B: Step-by-Step AI Tutor & SM-2 Spaced Repetition Daily Review & Mastery Map
 * Pillar C: Teacher CMS Question Bank, Live Classroom with WebSocket & Remedial Dashboard
 */

(function () {
  const API = (window.CERDAS_CONFIG?.apiBaseUrl || `${window.location.origin}/api`).replace(/\/$/, '');
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function showToast(message) {
    const toast = $('#toast');
    const toastMsg = $('#toast-message');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
  }

  function getStudentId() {
    try {
      const account = JSON.parse(localStorage.getItem('cerdas-cermat-account') || 'null');
      return localStorage.getItem('cerdas-cermat-token') && account?.id ? account.id : '';
    } catch {
      return '';
    }
  }

  function getAuthHeader() {
    const token = localStorage.getItem('cerdas-cermat-token') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiRequest(url, options = {}) {
    const headers = { ...getAuthHeader(), ...(options.headers || {}) };
    const response = await fetch(url, { ...options, headers });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(json.error || json.message || 'Terjadi kesalahan sistem.');
      error.status = response.status;
      throw error;
    }
    return json;
  }

  // ==========================================
  // PILLAR A: ADAPTIVE PROFILE & PLACEMENT TEST
  // ==========================================

  let placementState = {
    questions: [],
    currentIndex: 0,
    answers: {},
    level: 'sd',
    subjectId: 'matematika',
  };

  async function loadAdaptiveProfile() {
    const studentId = getStudentId();
    const pill = $('#user-adaptive-pill');
    const lvlEl = $('#user-adaptive-level');
    const xpEl = $('#user-adaptive-xp');
    const placementBtn = $('#placement-link');
    const teacherCmsBtn = $('#teacher-cms-link');

    // Update teacher CMS visibility
    try {
      const account = JSON.parse(localStorage.getItem('cerdas-cermat-account') || 'null');
      if (teacherCmsBtn) {
        teacherCmsBtn.hidden = !account || !['teacher', 'admin'].includes(account.role);
      }
    } catch {}

    if (!studentId) {
      if (pill) pill.hidden = true;
      if (placementBtn) placementBtn.hidden = true;
      return;
    }

    if (placementBtn) placementBtn.hidden = false;

    try {
      const data = await apiRequest(`${API}/adaptive/profile?studentId=${encodeURIComponent(studentId)}`);
      const profile = data.profile || {};
      if (pill && lvlEl && xpEl) {
        lvlEl.textContent = `Level ${profile.levelNumber || 1} (${profile.levelName || 'Pemula'})`;
        xpEl.textContent = `${profile.xp || 0} XP`;
        pill.hidden = false;
        pill.title = `Streak: ${profile.streak || 0} | Total Dijawab: ${profile.totalAnswered || 0}`;
      }
    } catch (err) {
      console.warn('Failed to load adaptive profile:', err);
    }
  }

  function openPlacementDialog() {
    const dialog = $('#placement-dialog');
    if (!dialog) return;
    $('#placement-setup').hidden = false;
    $('#placement-quiz').hidden = true;
    $('#placement-result').hidden = true;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePlacementDialog() {
    const dialog = $('#placement-dialog');
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function startPlacementTest() {
    const level = $('#placement-level-select')?.value || 'sd';
    const subjectId = $('#placement-subject-select')?.value || 'matematika';
    placementState = {
      questions: [],
      currentIndex: 0,
      answers: {},
      level,
      subjectId,
    };

    try {
      const data = await apiRequest(`${API}/adaptive/placement?level=${level}&subjectId=${subjectId}`);
      if (!data.questions || data.questions.length === 0) {
        showToast('Soal tes penempatan tidak ditemukan untuk pilihan ini.');
        return;
      }
      placementState.questions = data.questions;
      $('#placement-setup').hidden = true;
      $('#placement-quiz').hidden = false;
      $('#placement-result').hidden = true;
      renderPlacementQuestion(0);
    } catch (err) {
      showToast(err.message);
    }
  }

  function renderPlacementQuestion(index) {
    if (index < 0 || index >= placementState.questions.length) return;
    placementState.currentIndex = index;
    const q = placementState.questions[index];
    const total = placementState.questions.length;

    const fillPct = Math.round(((index + 1) / total) * 100);
    const progressFill = $('#placement-progress-fill');
    if (progressFill) progressFill.style.width = `${fillPct}%`;

    const counter = $('#placement-counter');
    if (counter) counter.textContent = `Soal ${index + 1} dari ${total}`;

    const diffTag = $('#placement-difficulty-tag');
    if (diffTag) {
      diffTag.textContent = q.difficulty ? q.difficulty.toUpperCase() : 'ADAPTIF';
      diffTag.className = `difficulty-tag ${q.difficulty || 'sedang'}`;
    }

    const prompt = $('#placement-prompt');
    if (prompt) prompt.textContent = q.prompt;

    const choicesContainer = $('#placement-choices');
    if (choicesContainer) {
      const selectedChoice = placementState.answers[q.id];
      const letters = ['A', 'B', 'C', 'D'];
      choicesContainer.innerHTML = (q.choices || []).map((choice, cIdx) => {
        const isChosen = selectedChoice === cIdx;
        return `
          <button type="button" class="placement-choice-btn ${isChosen ? 'is-selected' : ''}" data-choice="${cIdx}">
            <span class="choice-letter">${letters[cIdx]}.</span>
            <span>${choice}</span>
          </button>
        `;
      }).join('');

      $$('.placement-choice-btn', choicesContainer).forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = Number(btn.dataset.choice);
          placementState.answers[q.id] = c;
          renderPlacementQuestion(placementState.currentIndex);
        });
      });
    }

    const prevBtn = $('#placement-prev-btn');
    if (prevBtn) prevBtn.disabled = index === 0;

    const nextBtn = $('#placement-next-btn');
    const submitBtn = $('#placement-submit-btn');
    const isLast = index === total - 1;
    if (nextBtn) nextBtn.hidden = isLast;
    if (submitBtn) submitBtn.hidden = !isLast;
  }

  async function submitPlacementTest() {
    const studentId = getStudentId();
    try {
      const data = await apiRequest(`${API}/adaptive/placement/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          level: placementState.level,
          subjectId: placementState.subjectId,
          answers: placementState.answers,
        }),
      });

      const res = data.result || {};
      $('#placement-quiz').hidden = true;
      $('#placement-result').hidden = false;

      const lvlEl = $('#placement-res-level');
      if (lvlEl) lvlEl.textContent = `Level ${res.levelNumber} (${res.levelName})`;

      const scoreEl = $('#placement-res-score');
      if (scoreEl) scoreEl.textContent = `${res.score}%`;

      const xpEl = $('#placement-res-xp');
      if (xpEl) xpEl.textContent = `+${res.xpEarned} XP`;

      const descEl = $('#placement-res-desc');
      if (descEl) {
        descEl.textContent = `Berdasarkan ${res.correctCount} jawaban benar dari ${res.totalQuestions} soal, sistem menetapkan tingkat kesulitan awal belajarmu ke kategori "${res.targetDifficulty.toUpperCase()}".`;
      }

      const badgesRow = $('#placement-badges-row');
      if (badgesRow) {
        badgesRow.innerHTML = (res.badgesEarned || []).map((b) => `<span class="badge-chip">🌱 Lencana: ${b === 'perfect_100' ? 'Sempurna 100%' : 'Langkah Pertama'}</span>`).join('');
      }

      await loadAdaptiveProfile();
      showToast(data.message || 'Tes penempatan berhasil diselesaikan!');
    } catch (err) {
      showToast(err.message);
    }
  }

  // ==========================================
  // PILLAR B: AI TUTOR STEP-BY-STEP & SM-2
  // ==========================================

  let currentTutorState = null;

  async function openAiTutorModal({ questionId, prompt, choices, answer, choice, explanation, subject, level }) {
    currentTutorState = { questionId, prompt, choices, answer, choice, explanation, subject, level };
    const dialog = $('#ai-tutor-dialog');
    if (!dialog) return;

    $('#tutor-original-prompt').textContent = prompt;
    const letters = ['A', 'B', 'C', 'D'];
    $('#tutor-user-choice').textContent = choice !== undefined && choices[choice] ? `${letters[choice]}. ${choices[choice]}` : 'Tidak dijawab';
    $('#tutor-correct-choice').textContent = answer !== undefined && choices[answer] ? `${letters[answer]}. ${choices[answer]}` : '-';

    const cacheBadge = $('#tutor-cache-badge');
    if (cacheBadge) cacheBadge.hidden = true;

    const explanationContent = $('#tutor-explanation-content');
    explanationContent.innerHTML = `<div class="tutor-loading-spinner" style="padding:15px;color:#557855;font-style:italic;">Menghubungkan ke Tutor AI untuk menganalisis konsep dan menyusun langkah demi langkah…</div>`;

    const practiceBox = $('#tutor-practice-box');
    if (practiceBox) practiceBox.hidden = true;

    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
      const tutorData = await apiRequest(`${API}/ai/tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          prompt,
          choices,
          answer,
          choice,
          explanation,
          subject,
          level,
        }),
      });

      if (cacheBadge && tutorData.cached) cacheBadge.hidden = false;
      explanationContent.textContent = tutorData.explanation || 'Pembahasan telah siap.';

      if (tutorData.similarQuestion && practiceBox) {
        practiceBox.hidden = false;
        $('#tutor-practice-prompt').textContent = tutorData.similarQuestion.prompt;
        const practiceChoicesContainer = $('#tutor-practice-choices');
        const feedbackEl = $('#tutor-practice-feedback');
        if (feedbackEl) feedbackEl.hidden = true;

        practiceChoicesContainer.innerHTML = (tutorData.similarQuestion.choices || []).map((ch, cIndex) => {
          return `<button type="button" class="tutor-practice-choice-btn" data-choice="${cIndex}">
            <strong>${letters[cIndex]}.</strong> <span>${ch}</span>
          </button>`;
        }).join('');

        $$('.tutor-practice-choice-btn', practiceChoicesContainer).forEach((btn) => {
          btn.addEventListener('click', () => {
            const chosen = Number(btn.dataset.choice);
            const isCorrect = chosen === tutorData.similarQuestion.answer;
            $$('.tutor-practice-choice-btn', practiceChoicesContainer).forEach((b) => {
              b.disabled = true;
              if (Number(b.dataset.choice) === tutorData.similarQuestion.answer) {
                b.style.borderColor = '#4a794e';
                b.style.backgroundColor = '#eef5ec';
              }
              if (Number(b.dataset.choice) === chosen && !isCorrect) {
                b.style.borderColor = '#bd4f41';
                b.style.backgroundColor = '#fae9e6';
              }
            });
            if (feedbackEl) {
              feedbackEl.hidden = false;
              feedbackEl.style.backgroundColor = isCorrect ? '#eaf4e8' : '#fbe9e6';
              feedbackEl.style.color = isCorrect ? '#234a26' : '#882b1d';
              feedbackEl.innerHTML = `<strong>${isCorrect ? 'Benar!' : 'Belum tepat.'}</strong> ${tutorData.similarQuestion.explanation}`;
            }
          });
        });
      }
    } catch (err) {
      explanationContent.innerHTML = `<p style="color:#a83b2c;">Gagal memuat Tutor AI: ${err.message}. Tetap gunakan pembahasan dasar: ${explanation}</p>`;
    }
  }

  function closeAiTutorDialog() {
    const dialog = $('#ai-tutor-dialog');
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function handleTutorReschedule(understood) {
    if (!currentTutorState) return;
    const studentId = getStudentId();
    try {
      const data = await apiRequest(`${API}/sm2/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          questionId: currentTutorState.questionId,
          understood: Boolean(understood),
        }),
      });

      if (data.mastered) {
        showToast('Luar biasa! Konsep ini telah kamu kuasai (Streak 3x) 🏆');
      } else if (understood) {
        showToast('Hebat! Soal dijadwalkan ulang via SM-2 untuk review berikutnya.');
      } else {
        showToast('Soal diprioritaskan masuk antrean review harian segera.');
      }
      closeAiTutorDialog();
      await loadAdaptiveProfile();
    } catch (err) {
      showToast(err.message);
    }
  }

  // ==========================================
  // PILLAR B: SPACES REPETITION (SM-2) MODAL
  // ==========================================

  function openSm2Dialog() {
    const dialog = $('#sm2-dialog');
    if (!dialog) return;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadSm2Queue();
  }

  function closeSm2Dialog() {
    const dialog = $('#sm2-dialog');
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function loadSm2Queue() {
    const studentId = getStudentId();
    const container = $('#sm2-queue-container');
    const countEl = $('#sm2-queue-count');
    if (!container) return;

    if (!studentId) {
      container.innerHTML = `<p class="sm2-empty-state">Silakan masuk ke akun siswa untuk melihat antrean review harian.</p>`;
      return;
    }

    try {
      const data = await apiRequest(`${API}/sm2/queue?studentId=${encodeURIComponent(studentId)}`);
      const queue = data.queue || [];
      if (countEl) countEl.textContent = String(queue.length);

      if (queue.length === 0) {
        container.innerHTML = `
          <div class="sm2-empty-state">
            <span class="sm2-empty-icon">🎉</span>
            <strong>Semua materi telah dikuasai atau belum jatuh tempo review!</strong>
            <p>Lanjutkan latihan kuis untuk memperkaya pemahaman materi.</p>
          </div>
        `;
        return;
      }

      const letters = ['A', 'B', 'C', 'D'];
      container.innerHTML = queue.map((item, idx) => {
        return `
          <div class="sm2-queue-card" data-qid="${item.questionId}">
            <div class="sm2-card-meta">
              <span>Kartu ${idx + 1} · Repetisi: ${item.repetitions || 0} · Streak: ${item.streak || 0}/3</span>
              <span>Interval: ${item.interval || 1} hari</span>
            </div>
            <p class="sm2-card-prompt">${item.prompt}</p>
            <div class="sm2-card-choices">
              ${(item.choices || []).map((c, i) => `<div class="sm2-choice-pill"><strong>${letters[i]}.</strong> ${c}</div>`).join('')}
            </div>
            <div class="sm2-reveal-box" id="reveal-${item.questionId}" hidden>
              <strong>Kunci Jawaban: ${letters[item.answer] || 'A'}. ${item.choices?.[item.answer] || ''}</strong>
              <p style="margin:4px 0 0;color:#454b40;">${item.explanation || 'Pembahasan esensial'}</p>
            </div>
            <div class="sm2-rating-row">
              <button type="button" class="catalog-cancel sm2-toggle-reveal" data-qid="${item.questionId}" style="padding:4px 10px;font-size:11px;">Buka Pembahasan</button>
              <div class="sm2-rate-actions" id="rate-row-${item.questionId}" hidden>
                <span style="font-size:10.5px;color:#6b7064;margin-right:4px;">Tingkat ingatan:</span>
                <button type="button" class="sm2-rate-btn" data-qid="${item.questionId}" data-q="0" title="Lupa sama sekali">0 · Lupa</button>
                <button type="button" class="sm2-rate-btn" data-qid="${item.questionId}" data-q="3" title="Ingat dengan ragu">3 · Ragu</button>
                <button type="button" class="sm2-rate-btn" data-qid="${item.questionId}" data-q="5" title="Sangat mudah & paham">5 · Paham</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      $$('.sm2-toggle-reveal', container).forEach((btn) => {
        btn.addEventListener('click', () => {
          const qid = btn.dataset.qid;
          const rev = $(`#reveal-${qid}`, container);
          const rateRow = $(`#rate-row-${qid}`, container);
          if (rev) rev.hidden = false;
          if (rateRow) rateRow.hidden = false;
          btn.hidden = true;
        });
      });

      $$('.sm2-rate-btn', container).forEach((btn) => {
        btn.addEventListener('click', async () => {
          const qid = btn.dataset.qid;
          const quality = Number(btn.dataset.q);
          try {
            const result = await apiRequest(`${API}/sm2/reschedule`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId, questionId: qid, quality }),
            });
            if (result.mastered) {
              showToast('Luar biasa! Materi ini telah dikuasai penuh (Streak 3x) 🏆');
            } else {
              showToast(`Tersimpan! Jadwal review berikutnya: ${Math.round(result.sm2?.interval || 1)} hari.`);
            }
            loadSm2Queue();
            loadAdaptiveProfile();
          } catch (err) {
            showToast(err.message);
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<p style="color:#b23b2c;">Gagal memuat antrean SM-2: ${err.message}</p>`;
    }
  }

  async function loadSm2MasteryMap() {
    const studentId = getStudentId();
    if (!studentId) return;

    try {
      const data = await apiRequest(`${API}/sm2/mastery-map?studentId=${encodeURIComponent(studentId)}`);
      $('#mastery-total-tracked').textContent = String(data.totalTracked || 0);
      $('#mastery-total-mastered').textContent = String(data.masteredCount || 0);
      $('#mastery-total-progress').textContent = String(data.inProgressCount || 0);

      const barsContainer = $('#mastery-subject-bars');
      if (barsContainer) {
        const bySub = data.bySubject || {};
        const entries = Object.entries(bySub);
        if (entries.length === 0) {
          barsContainer.innerHTML = '<p style="color:#777b70;font-size:12px;">Belum ada topik yang dipelajari.</p>';
        } else {
          barsContainer.innerHTML = entries.map(([sub, stats]) => {
            const pct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
            return `
              <div class="mastery-bar-row">
                <div class="mastery-bar-label">
                  <strong style="text-transform:capitalize;">${sub}</strong>
                  <span>${stats.mastered}/${stats.total} dikuasai (${pct}%)</span>
                </div>
                <div class="mastery-bar-track">
                  <div class="mastery-bar-fill" style="width:${pct}%"></div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      const badgesGrid = $('#mastery-badges-grid');
      if (badgesGrid) {
        const profileData = await apiRequest(`${API}/adaptive/profile?studentId=${encodeURIComponent(studentId)}`).catch(() => ({}));
        const userBadges = new Set(profileData.profile?.badges || []);
        const catalog = profileData.badgesCatalog || [
          { id: 'first_step', name: 'Langkah Pertama', icon: '🌱', description: 'Menyelesaikan kuis pertama.' },
          { id: 'streak_3', name: 'Fokus Tajam', icon: '⚡', description: 'Menjawab benar 3 soal berturut-turut.' },
          { id: 'master_topic', name: 'Penguasa Materi', icon: '🏆', description: 'Menguasai materi dengan SM-2.' },
          { id: 'quiz_complete_50', name: 'Penjelajah 50 Soal', icon: '🎖️', description: 'Menyelesaikan 50 soal.' },
          { id: 'perfect_100', name: 'Sempurna', icon: '⭐', description: 'Meraih skor 100% pada kuis.' },
        ];

        badgesGrid.innerHTML = catalog.map((b) => {
          const unlocked = userBadges.has(b.id);
          return `
            <div class="mastery-badge-item" style="opacity:${unlocked ? 1 : 0.45};">
              <span class="mastery-badge-icon">${b.icon}</span>
              <div class="mastery-badge-info">
                <strong>${b.name} ${unlocked ? '✓' : ''}</strong>
                <small>${b.description}</small>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('Failed to load mastery map:', err);
    }
  }

  // ==========================================
  // PILLAR C: LIVE CLASSROOM (WEBSOCKET)
  // ==========================================

  let liveWs = null;
  let liveTimerInterval = null;
  let liveTimeRemaining = 20;
  let liveQuestionStartTime = 0;
  let currentLiveRoom = null;
  let isHostTeacher = false;

  function openLiveClassDialog() {
    const dialog = $('#live-class-dialog');
    if (!dialog) return;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Check role
    try {
      const account = JSON.parse(localStorage.getItem('cerdas-cermat-account') || 'null');
      const isTeacher = account && ['teacher', 'admin'].includes(account.role);
      $('#live-tab-teacher-btn').hidden = !isTeacher;
      if (account?.name && $('#live-name-input')) {
        $('#live-name-input').value = account.name;
      }
    } catch {}
  }

  function closeLiveClassDialog() {
    const dialog = $('#live-class-dialog');
    if (!dialog) return;
    if (liveWs) {
      try { liveWs.close(); } catch {}
      liveWs = null;
    }
    clearInterval(liveTimerInterval);
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function connectLiveWebSocket(pin, isTeacher = false) {
    if (liveWs) {
      try { liveWs.close(); } catch {}
    }

    const studentId = getStudentId() || `guest-${Math.random().toString(36).substring(2, 9)}`;
    const studentName = $('#live-name-input')?.value || 'Siswa';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-class?pin=${encodeURIComponent(pin)}&studentId=${encodeURIComponent(studentId)}&studentName=${encodeURIComponent(studentName)}${isTeacher ? '&teacher=1' : ''}`;

    liveWs = new WebSocket(wsUrl);

    liveWs.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleLiveWsEvent(payload);
      } catch (err) {
        console.warn('WS message error:', err);
      }
    };

    liveWs.onerror = () => {
      console.warn('WebSocket error on live room');
    };

    liveWs.onclose = () => {
      console.log('Live WS closed');
    };
  }

  function handleLiveWsEvent(msg) {
    const { event, data } = msg;
    if (event === 'room_state' || event === 'new_question' || event === 'question_review' || event === 'quiz_finished') {
      currentLiveRoom = data;
      renderLiveRoomView(data);
    } else if (event === 'student_joined' || event === 'student_left' || event === 'answer_received') {
      if (data.room) currentLiveRoom = data.room;
      if (data.leaderboard) renderLiveLeaderboard(data.leaderboard);
      if (data.answeredCount !== undefined) {
        const statusEl = $('#live-room-status');
        if (statusEl) statusEl.textContent = `${data.answeredCount}/${data.totalStudents} siswa telah menjawab.`;
      }
    }
  }

  function renderLiveRoomView(room) {
    $('#live-student-join-panel').hidden = true;
    $('#live-teacher-create-panel').hidden = true;
    $('#live-mode-tabs').hidden = true;
    $('#live-room-arena').hidden = false;

    $('#live-active-pin').textContent = room.pin;
    $('#live-room-title').textContent = room.title || 'Kuis Kelas Live';

    const teacherControls = $('#live-teacher-controls');
    if (teacherControls) teacherControls.hidden = !isHostTeacher;

    const qView = $('#live-question-view');
    const qHeader = $('#live-q-number');
    const qDiff = $('#live-q-difficulty');
    const qPrompt = $('#live-q-prompt');
    const choicesContainer = $('#live-choices-container');
    const reviewBox = $('#live-review-box');

    renderLiveLeaderboard(room.leaderboard || room.students || []);

    if (room.status === 'waiting') {
      $('#live-room-status').textContent = `Menunggu guru memulai pertanyaan (${(room.students || []).length} siswa telah bergabung)`;
      qPrompt.textContent = 'Bersiaplah! Pertanyaan kuis akan muncul serentak di layar Anda saat guru memulai.';
      choicesContainer.innerHTML = '';
      if (reviewBox) reviewBox.hidden = true;
      clearInterval(liveTimerInterval);
      $('#live-timer-val').textContent = 'Siap';
      return;
    }

    if (room.status === 'finished') {
      $('#live-room-status').textContent = 'Kuis kelas telah selesai! Selamat kepada para pemenang!';
      qPrompt.textContent = '🎉 Kuis Selesai! Lihat papan peringkat akhir di sebelah kanan.';
      choicesContainer.innerHTML = '';
      if (reviewBox) reviewBox.hidden = true;
      clearInterval(liveTimerInterval);
      $('#live-timer-val').textContent = 'Selesai';
      return;
    }

    const q = room.currentQuestion;
    if (!q) return;

    $('#live-room-status').textContent = `Soal ${q.index + 1} dari ${room.totalQuestions}`;
    qHeader.textContent = `Soal ${q.index + 1} dari ${room.totalQuestions}`;
    qDiff.textContent = (q.difficulty || 'Sedang').toUpperCase();
    qPrompt.textContent = q.prompt;

    const letters = ['A', 'B', 'C', 'D'];
    choicesContainer.innerHTML = (q.choices || []).map((ch, idx) => {
      let extraClass = '';
      if (room.status === 'question_review' && q.answer !== undefined) {
        if (idx === q.answer) extraClass = 'is-correct';
      }
      return `
        <button type="button" class="live-choice-btn ${extraClass}" data-choice="${idx}" ${room.status === 'question_review' ? 'disabled' : ''}>
          <strong>${letters[idx]}.</strong>
          <span>${ch}</span>
        </button>
      `;
    }).join('');

    if (room.status === 'question_review') {
      clearInterval(liveTimerInterval);
      $('#live-timer-val').textContent = 'Review';
      if (reviewBox) {
        reviewBox.hidden = false;
        $('#live-review-text').textContent = q.explanation || 'Kunci jawaban telah ditampilkan.';
      }
    } else {
      if (reviewBox) reviewBox.hidden = true;
      startLiveTimer(q.timeLimitSeconds || 20);

      // Student choice click
      $$('.live-choice-btn', choicesContainer).forEach((btn) => {
        btn.addEventListener('click', async () => {
          const choiceIdx = Number(btn.dataset.choice);
          btn.classList.add('is-chosen');
          $$('.live-choice-btn', choicesContainer).forEach((b) => (b.disabled = true));
          const timeTakenMs = Date.now() - liveQuestionStartTime;
          try {
            const studentId = getStudentId() || `guest-${Math.random().toString(36).substring(2, 9)}`;
            const res = await apiRequest(`${API}/live/submit-answer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pin: room.pin,
                studentId,
                questionIndex: q.index,
                choiceIndex: choiceIdx,
                timeTakenMs,
              }),
            });
            if (res.isCorrect) showToast(`Benar! +${res.points} Poin (Termasuk bonus kecepatan) ⚡`);
            else showToast('Jawaban tercatat. Tunggu pembahasan guru.');
          } catch (err) {
            showToast(err.message);
          }
        });
      });
    }
  }

  function startLiveTimer(seconds) {
    clearInterval(liveTimerInterval);
    liveTimeRemaining = seconds;
    liveQuestionStartTime = Date.now();
    const timerVal = $('#live-timer-val');
    if (timerVal) timerVal.textContent = `${liveTimeRemaining}s`;

    liveTimerInterval = setInterval(() => {
      liveTimeRemaining -= 1;
      if (timerVal) timerVal.textContent = `${Math.max(0, liveTimeRemaining)}s`;
      if (liveTimeRemaining <= 0) {
        clearInterval(liveTimerInterval);
        $$('.live-choice-btn', $('#live-choices-container')).forEach((b) => (b.disabled = true));
      }
    }, 1000);
  }

  function renderLiveLeaderboard(studentsList) {
    const list = $('#live-leaderboard-list');
    if (!list) return;
    if (!studentsList || studentsList.length === 0) {
      list.innerHTML = `<li class="empty-board" style="color:#7b7f73;font-size:11px;">Belum ada peserta menjawab</li>`;
      return;
    }
    list.innerHTML = studentsList.slice(0, 10).map((s, idx) => {
      const medals = ['🥇', '🥈', '🥉'];
      const rank = idx < 3 ? medals[idx] : `${idx + 1}.`;
      return `
        <li class="live-leaderboard-item">
          <span>${rank} <strong>${s.name}</strong></span>
          <span>${s.score || 0} Poin</span>
        </li>
      `;
    }).join('');
  }

  // ==========================================
  // PILLAR C: TEACHER CMS BANK SOAL
  // ==========================================

  function openCmsDialog() {
    const dialog = $('#cms-dialog');
    if (!dialog) return;
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadCmsQuestions();
  }

  function closeCmsDialog() {
    const dialog = $('#cms-dialog');
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function loadCmsQuestions() {
    const container = $('#cms-questions-container');
    const totalCountEl = $('#cms-total-count');
    if (!container) return;

    const diff = $('#cms-filter-difficulty')?.value || '';
    const search = $('#cms-filter-search')?.value || '';

    try {
      const data = await apiRequest(`${API}/cms/questions?difficulty=${encodeURIComponent(diff)}&cpKdTag=${encodeURIComponent(search)}`);
      const list = data.questions || [];
      if (totalCountEl) totalCountEl.textContent = String(data.total || list.length);

      if (list.length === 0) {
        container.innerHTML = '<p style="color:#6d7166;font-size:12px;padding:20px;text-align:center;">Belum ada soal pada bank soal dengan filter ini. Tulis soal baru melalui tab di atas!</p>';
        return;
      }

      const letters = ['A', 'B', 'C', 'D'];
      container.innerHTML = list.map((q) => {
        return `
          <div class="cms-q-card">
            <div class="cms-q-meta">
              <span class="difficulty-tag ${q.difficulty}">${q.difficulty?.toUpperCase()}</span>
              <span><strong>CP/KD:</strong> ${q.cpKdTag || '-'} · ${q.subjectId} (${q.level?.toUpperCase()})</span>
            </div>
            <p class="cms-q-prompt">${q.prompt}</p>
            <div class="cms-q-choices">
              ${(q.choices || []).map((c, i) => `<div style="${i === q.answer ? 'font-weight:700;color:#2c5b30;' : ''}">${letters[i]}. ${c} ${i === q.answer ? '✓ (Kunci)' : ''}</div>`).join('')}
            </div>
            <p style="font-size:11px;margin:8px 0 0;color:#5a5e52;border-top:1px dotted #ded9cc;padding-top:6px;"><strong>Pembahasan:</strong> ${q.explanation}</p>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<p style="color:#ba3e30;">Gagal memuat bank soal: ${err.message}</p>`;
    }
  }

  // ==========================================
  // INITIALIZE EVENT LISTENERS
  // ==========================================

  function initPillars() {
    // Placement Test buttons
    $('#placement-link')?.addEventListener('click', openPlacementDialog);
    $('#close-placement')?.addEventListener('click', closePlacementDialog);
    $('#start-placement-btn')?.addEventListener('click', startPlacementTest);
    $('#placement-prev-btn')?.addEventListener('click', () => renderPlacementQuestion(placementState.currentIndex - 1));
    $('#placement-next-btn')?.addEventListener('click', () => renderPlacementQuestion(placementState.currentIndex + 1));
    $('#placement-submit-btn')?.addEventListener('click', submitPlacementTest);
    $('#placement-confirm-btn')?.addEventListener('click', () => {
      closePlacementDialog();
      window.location.hash = '#rak';
    });

    // AI Tutor buttons
    $('#close-ai-tutor')?.addEventListener('click', closeAiTutorDialog);
    $('#tutor-understood-btn')?.addEventListener('click', () => handleTutorReschedule(true));
    $('#tutor-not-understood-btn')?.addEventListener('click', () => handleTutorReschedule(false));

    // SM-2 Review & Mastery buttons
    $('#sm2-link')?.addEventListener('click', openSm2Dialog);
    $('#close-sm2')?.addEventListener('click', closeSm2Dialog);
    $('#sm2-tab-queue-btn')?.addEventListener('click', () => {
      $('#sm2-tab-queue-btn').classList.add('active');
      $('#sm2-tab-map-btn').classList.remove('active');
      $('#sm2-queue-panel').hidden = false;
      $('#sm2-map-panel').hidden = true;
      loadSm2Queue();
    });
    $('#sm2-tab-map-btn')?.addEventListener('click', () => {
      $('#sm2-tab-map-btn').classList.add('active');
      $('#sm2-tab-queue-btn').classList.remove('active');
      $('#sm2-queue-panel').hidden = true;
      $('#sm2-map-panel').hidden = false;
      loadSm2MasteryMap();
    });

    // Live Classroom buttons
    $('#live-class-link')?.addEventListener('click', openLiveClassDialog);
    $('#close-live-class')?.addEventListener('click', closeLiveClassDialog);
    $('#live-tab-student-btn')?.addEventListener('click', () => {
      $('#live-tab-student-btn').classList.add('active');
      $('#live-tab-teacher-btn').classList.remove('active');
      $('#live-student-join-panel').hidden = false;
      $('#live-teacher-create-panel').hidden = true;
    });
    $('#live-tab-teacher-btn')?.addEventListener('click', () => {
      $('#live-tab-teacher-btn').classList.add('active');
      $('#live-tab-student-btn').classList.remove('active');
      $('#live-student-join-panel').hidden = true;
      $('#live-teacher-create-panel').hidden = false;
    });

    // Live Join Form (Student)
    $('#live-join-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('#live-pin-input').value.trim();
      const studentName = $('#live-name-input').value.trim();
      const studentId = getStudentId() || `guest-${Math.random().toString(36).substring(2, 9)}`;
      const errorEl = $('#live-join-error');
      if (errorEl) errorEl.textContent = '';

      try {
        const res = await apiRequest(`${API}/live/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, studentId, studentName }),
        });
        isHostTeacher = false;
        connectLiveWebSocket(pin, false);
        currentLiveRoom = res.room;
        renderLiveRoomView(res.room);
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message;
      }
    });

    // Live Create Form (Teacher)
    $('#live-create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('#live-create-title').value.trim();
      const level = $('#live-create-level').value;
      const subjectId = $('#live-create-subject').value;
      const questionCount = Number($('#live-create-count').value);
      const errorEl = $('#live-create-error');
      if (errorEl) errorEl.textContent = '';

      try {
        const res = await apiRequest(`${API}/live/create-room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, level, subjectId, questionCount }),
        });
        isHostTeacher = true;
        const pin = res.room.pin;
        connectLiveWebSocket(pin, true);
        currentLiveRoom = res.room;
        renderLiveRoomView(res.room);
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message;
      }
    });

    // Teacher Live Controls
    $('#live-next-q-btn')?.addEventListener('click', async () => {
      if (!currentLiveRoom) return;
      try {
        await apiRequest(`${API}/live/next-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: currentLiveRoom.pin }),
        });
      } catch (err) {
        showToast(err.message);
      }
    });

    $('#live-review-q-btn')?.addEventListener('click', async () => {
      if (!currentLiveRoom) return;
      try {
        await apiRequest(`${API}/live/show-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: currentLiveRoom.pin }),
        });
      } catch (err) {
        showToast(err.message);
      }
    });

    // CMS Bank Soal buttons
    $('#teacher-cms-link')?.addEventListener('click', openCmsDialog);
    $('#close-cms')?.addEventListener('click', closeCmsDialog);
    $('#cms-tab-create-btn')?.addEventListener('click', () => {
      $('#cms-tab-create-btn').classList.add('active');
      $('#cms-tab-list-btn').classList.remove('active');
      $('#cms-create-panel').hidden = false;
      $('#cms-list-panel').hidden = true;
    });
    $('#cms-tab-list-btn')?.addEventListener('click', () => {
      $('#cms-tab-list-btn').classList.add('active');
      $('#cms-tab-create-btn').classList.remove('active');
      $('#cms-create-panel').hidden = true;
      $('#cms-list-panel').hidden = false;
      loadCmsQuestions();
    });

    // CMS Question Form Submission
    $('#cms-question-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = $('#cms-q-prompt').value.trim();
      const choices = [
        $('#cms-choice-0').value.trim(),
        $('#cms-choice-1').value.trim(),
        $('#cms-choice-2').value.trim(),
        $('#cms-choice-3').value.trim(),
      ];
      const answer = Number($('input[name="cms-correct"]:checked')?.value || 0);
      const explanation = $('#cms-q-explanation').value.trim();
      const cpKdTag = $('#cms-q-cpkd').value.trim();
      const difficulty = $('#cms-q-difficulty').value;
      const level = $('#cms-q-level').value;
      const subjectId = $('#cms-q-subject').value;
      const errorEl = $('#cms-error');
      if (errorEl) errorEl.textContent = '';

      try {
        const res = await apiRequest(`${API}/cms/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            choices,
            answer,
            explanation,
            cpKdTag,
            difficulty,
            level,
            subjectId,
          }),
        });

        showToast(res.message || 'Soal berhasil disimpan ke Bank Soal!');
        $('#cms-question-form').reset();
        $('#cms-tab-list-btn').click();
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message;
      }
    });

    $('#cms-filter-search')?.addEventListener('input', loadCmsQuestions);
    $('#cms-filter-difficulty')?.addEventListener('change', loadCmsQuestions);

    // Remedial Class Dashboard Recommendation hook
    $('#class-dashboard-select')?.addEventListener('change', async (e) => {
      const classId = e.target.value;
      if (!classId) return;
      try {
        const data = await apiRequest(`${API}/classes/${encodeURIComponent(classId)}/remedial`);
        const container = $('#class-dashboard-summary');
        if (container && data.recommendations) {
          const recHtml = data.recommendations.map((r) => `
            <div style="background:#fcfbf8;border:1px solid #dcd7c7;border-left:3px solid ${r.needsRemedial ? '#a34839' : '#49694c'};padding:10px;margin-top:8px;border-radius:4px;">
              <strong>${r.studentName}</strong> <span style="font-size:11px;color:#71746a;">(Level: ${r.adaptiveLevel} · ${r.xp} XP)</span>
              <p style="margin:4px 0;font-size:11.5px;color:${r.needsRemedial ? '#963c2f' : '#2d5a31'};">${r.recommendedAction}</p>
              ${r.weakTopics?.length ? `<small style="color:#71746a;">Topik perlu penguatan: ${r.weakTopics.map((w) => `${w.topic} (${w.score}%)`).join(', ')}</small>` : ''}
            </div>
          `).join('');
          container.insertAdjacentHTML('beforeend', `<div style="margin-top:14px;"><h4>Rekomendasi Remedial Siswa</h4>${recHtml}</div>`);
        }
      } catch {}
    });

    // Global listener for question feedback SM-2 / AI Tutor triggers
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.sm2-action-btn');
      if (!target) return;
      const action = target.dataset.action;
      const qid = target.dataset.qid;
      const questionCard = target.closest('.question');

      if (action === 'understood') {
        const studentId = getStudentId();
        apiRequest(`${API}/sm2/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, questionId: qid, understood: true }),
        }).then(() => {
          showToast('Tercatat! Soal dijadwalkan ulang via SM-2.');
          target.textContent = '✓ Dijadwalkan SM-2';
          target.disabled = true;
          loadAdaptiveProfile();
        }).catch((err) => showToast(err.message));
      } else if (action === 'ai-tutor') {
        const promptText = questionCard?.querySelector('.question-prompt')?.textContent || '';
        const choices = [...(questionCard?.querySelectorAll('.choice') || [])].map((c) => c.querySelector('span:last-child')?.textContent || '');
        const choiceBtn = questionCard?.querySelector('.choice.is-wrong');
        const userChoice = choiceBtn ? Number(choiceBtn.dataset.choice) : 0;
        const correctBtn = questionCard?.querySelector('.choice.is-correct');
        const correctChoice = correctBtn ? Number(correctBtn.dataset.choice) : 0;

        openAiTutorModal({
          questionId: qid,
          prompt: promptText,
          choices,
          answer: correctChoice,
          choice: userChoice,
          explanation: target.dataset.explanation || 'Pembahasan materi',
          subject: $('#reader-subject')?.textContent || 'Mata Pelajaran',
          level: $('#reader-level')?.textContent || 'SD',
        });
      }
    });

    // Initial load
    void loadAdaptiveProfile();
  }

  // Export to global scope
  window.CerdasPillars = {
    loadAdaptiveProfile,
    openPlacementDialog,
    openAiTutorModal,
    openSm2Dialog,
    openLiveClassDialog,
    openCmsDialog,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPillars);
  } else {
    initPillars();
  }
})();
