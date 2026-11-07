import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---- Schema reference ----
// users/{uid}/exams/{examId}
//   subject: string
//   examDate: Timestamp
//   confidence: "low" | "medium" | "high"
//   topics: [{ name: string, completed: boolean }]
//   allocatedDays: number
//   progress: number (0-100)
//   createdAt: Timestamp

function examsRef(uid) {
  if (!uid) throw new Error("examsRef: uid is required");
  return collection(db, "users", uid, "exams");
}

/**
 * Add a new exam for a user.
 * @param {string} uid
 * @param {{subject:string, examDate:Date, confidence:string, topics:string[], allocatedDays:number}} examData
 * @returns {Promise<string>} new exam doc id
 */
export async function addExam(uid, examData) {
  if (!uid) throw new Error("addExam: uid is required");
  if (!examData || typeof examData !== "object") {
    throw new Error("addExam: examData is required");
  }
  const { subject, examDate, confidence, topics, allocatedDays } = examData;

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new Error("addExam: subject is required");
  }
  if (!(examDate instanceof Date) || isNaN(examDate.getTime())) {
    throw new Error("addExam: examDate must be a valid Date");
  }
  if (!["low", "medium", "high"].includes(confidence)) {
    throw new Error("addExam: confidence must be low, medium, or high");
  }

  const safeTopics = Array.isArray(topics)
    ? topics
        .filter((t) => typeof t === "string" && t.trim())
        .map((t) => ({ name: t.trim(), completed: false }))
    : [];

  const safeAllocatedDays =
    typeof allocatedDays === "number" && allocatedDays > 0 ? allocatedDays : 0;

  try {
    const docRef = await addDoc(examsRef(uid), {
      subject: subject.trim(),
      examDate: Timestamp.fromDate(examDate),
      confidence,
      topics: safeTopics,
      allocatedDays: safeAllocatedDays,
      progress: 0,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.error("addExam failed:", err);
    throw new Error("Could not add exam. Please try again.");
  }
}

/**
 * Update fields on an existing exam. Pass only the fields you want changed.
 * @param {string} uid
 * @param {string} examId
 * @param {object} updates
 */
export async function updateExam(uid, examId, updates) {
  if (!uid) throw new Error("updateExam: uid is required");
  if (!examId) throw new Error("updateExam: examId is required");
  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    throw new Error("updateExam: updates object is required");
  }

  const cleanUpdates = { ...updates };
  if (cleanUpdates.examDate instanceof Date) {
    cleanUpdates.examDate = Timestamp.fromDate(cleanUpdates.examDate);
  }

  try {
    const examDoc = doc(db, "users", uid, "exams", examId);
    await updateDoc(examDoc, cleanUpdates);
  } catch (err) {
    console.error("updateExam failed:", err);
    throw new Error("Could not update exam. Please try again.");
  }
}

/**
 * Toggle a single topic's completed state and recalculate progress %.
 * @param {string} uid
 * @param {string} examId
 * @param {{name:string, completed:boolean}[]} currentTopics - current topics array from the exam doc
 * @param {number} topicIndex
 */
export async function toggleTopicComplete(uid, examId, currentTopics, topicIndex) {
  if (!Array.isArray(currentTopics) || !currentTopics[topicIndex]) {
    throw new Error("toggleTopicComplete: invalid topic index");
  }
  const updatedTopics = currentTopics.map((t, i) =>
    i === topicIndex ? { ...t, completed: !t.completed } : t
  );
  const completedCount = updatedTopics.filter((t) => t.completed).length;
  const progress =
    updatedTopics.length > 0
      ? Math.round((completedCount / updatedTopics.length) * 100)
      : 0;

  await updateExam(uid, examId, { topics: updatedTopics, progress });
}

/**
 * Delete an exam permanently.
 * @param {string} uid
 * @param {string} examId
 */
export async function deleteExam(uid, examId) {
  if (!uid) throw new Error("deleteExam: uid is required");
  if (!examId) throw new Error("deleteExam: examId is required");

  try {
    const examDoc = doc(db, "users", uid, "exams", examId);
    await deleteDoc(examDoc);
  } catch (err) {
    console.error("deleteExam failed:", err);
    throw new Error("Could not delete exam. Please try again.");
  }
}

/**
 * Subscribe to live updates of a user's exams, ordered by exam date.
 * @param {string} uid
 * @param {(exams: object[]) => void} onUpdate - called with array of exam objects (each includes id)
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe function
 */
export function subscribeToExams(uid, onUpdate, onError) {
  if (!uid) throw new Error("subscribeToExams: uid is required");
  if (typeof onUpdate !== "function") {
    throw new Error("subscribeToExams: onUpdate callback is required");
  }

  const q = query(examsRef(uid), orderBy("examDate", "asc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const exams = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(exams);
    },
    (err) => {
      console.error("subscribeToExams listener error:", err);
      if (typeof onError === "function") onError(err);
    }
  );

  return unsubscribe;
}
