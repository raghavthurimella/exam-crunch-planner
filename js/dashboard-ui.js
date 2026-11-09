import {
  addExam,
  updateExam,
  deleteExam,
  subscribeToExams
} from "./exams.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

let currentUid = null;
let unsubscribeExams = null;
let currentExams = [];
let editingExamId = null;

const examListEl = document.getElementById("examList");
const emptyStateEl = document.getElementById("emptyState");
const addExamBtn = document.getElementById("addExamBtn");
const examModal = document.getElementById("examModal");
const examForm = document.getElementById("examForm");
const modalTitle = document.getElementById("modalTitle");
const cancelBtn = document.getElementById("cancelExamBtn");
const formError = document.getElementById("formError");

const subjectInput = document.getElementById("subjectInput");
const dateInput = document.getElementById("dateInput");
const confidenceInput = document.getElementById("confidenceInput");
const topicsInput = document.getElementById("topicsInput");
const allocatedDaysInput = document.getElementById("allocatedDaysInput");

onAuthStateChanged(auth, (user) => {
  if (!user) return; // requireAuth() elsewhere already redirects logged-out users
  currentUid = user.uid;
  startListening();
});

function startListening() {
  if (unsubscribeExams) unsubscribeExams();
  unsubscribeExams = subscribeToExams(
    currentUid,
    (exams) => {
      currentExams = exams;
      renderExams(exams);
    },
    (err) => {
      console.error("Failed to load exams:", err);
      examListEl.innerHTML = `<p class="error-text">Could not load exams. Please refresh.</p>`;
    }
  );
}

function renderExams(exams) {
  examListEl.innerHTML = "";

  if (!exams || exams.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  }
  emptyStateEl.style.display = "none";

  exams.forEach((exam) => {
    const daysLeft = getDaysLeft(exam.examDate);
    const urgencyClass = getUrgencyClass(daysLeft);

    const card = document.createElement("div");
    card.className = "exam-card";
    card.innerHTML = `
      <div class="exam-card-header">
        <h3>${escapeHtml(exam.subject)}</h3>
        <span class="badge ${urgencyClass}">${daysLeft >= 0 ? daysLeft + "d left" : "Past"}</span>
      </div>
      <p class="confidence-label">Confidence: ${escapeHtml(exam.confidence)}</p>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${exam.progress || 0}%"></div>
      </div>
      <p class="progress-text">${exam.progress || 0}% complete</p>
      <div class="exam-card-actions">
        <button class="btn btn-small edit-btn" type="button">Edit</button>
        <button class="btn btn-small btn-danger delete-btn" type="button">Delete</button>
      </div>
    `;

    card.querySelector(".edit-btn").addEventListener("click", () => openEditModal(exam));
    card.querySelector(".delete-btn").addEventListener("click", () => confirmDelete(exam));

    examListEl.appendChild(card);
  });
}

function getDaysLeft(examDateField) {
  if (!examDateField) return 0;
  const examDate = examDateField.toDate ? examDateField.toDate() : new Date(examDateField);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  examDate.setHours(0, 0, 0, 0);
  return Math.round((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyClass(daysLeft) {
  if (daysLeft < 0) return "urgency-past";
  if (daysLeft <= 3) return "urgency-red";
  if (daysLeft <= 7) return "urgency-amber";
  return "urgency-green";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---- Modal open/close ----

function openAddModal() {
  editingExamId = null;
  modalTitle.textContent = "Add Exam";
  examForm.reset();
  formError.textContent = "";
  examModal.classList.add("open");
}

function openEditModal(exam) {
  editingExamId = exam.id;
  modalTitle.textContent = "Edit Exam";
  formError.textContent = "";

  subjectInput.value = exam.subject || "";
  const examDate = exam.examDate?.toDate ? exam.examDate.toDate() : new Date(exam.examDate);
  dateInput.value = examDate.toISOString().split("T")[0];
  confidenceInput.value = exam.confidence || "";
  topicsInput.value = (exam.topics || []).map((t) => t.name).join(", ");
  allocatedDaysInput.value = exam.allocatedDays || "";

  examModal.classList.add("open");
}

function closeModal() {
  examModal.classList.remove("open");
  editingExamId = null;
  examForm.reset();
  formError.textContent = "";
}

addExamBtn.addEventListener("click", openAddModal);
cancelBtn.addEventListener("click", closeModal);

// ---- Form submit (add or edit) ----

examForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const subject = subjectInput.value.trim();
  const dateStr = dateInput.value;
  const confidence = confidenceInput.value;
  const topicsRaw = topicsInput.value;
  const allocatedDays = Number(allocatedDaysInput.value);

  if (!subject) {
    formError.textContent = "Subject is required.";
    return;
  }
  if (!dateStr) {
    formError.textContent = "Exam date is required.";
    return;
  }

  const examDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (examDate < today) {
    formError.textContent = "Exam date cannot be in the past.";
    return;
  }

  if (!["low", "medium", "high"].includes(confidence)) {
    formError.textContent = "Please select a confidence level.";
    return;
  }

  if (!allocatedDays || allocatedDays <= 0) {
    formError.textContent = "Allocated days must be a positive number.";
    return;
  }

  const topics = topicsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const submitBtn = examForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (editingExamId) {
      const existingExam = currentExams.find((ex) => ex.id === editingExamId);
      const existingTopics = existingExam?.topics || [];

      const mergedTopics = topics.map((name) => {
        const match = existingTopics.find((t) => t.name === name);
        return match ? match : { name, completed: false };
      });

      await updateExam(currentUid, editingExamId, {
        subject,
        examDate,
        confidence,
        topics: mergedTopics,
        allocatedDays
      });
    } else {
      await addExam(currentUid, { subject, examDate, confidence, topics, allocatedDays });
    }
    closeModal();
  } catch (err) {
    console.error("Save exam failed:", err);
    formError.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Delete ----

async function confirmDelete(exam) {
  const confirmed = window.confirm(`Delete "${exam.subject}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await deleteExam(currentUid, exam.id);
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Could not delete exam. Please try again.");
  }
}