const API_URL =
  "https://script.google.com/macros/s/AKfycbyOmwCSFitXC9WnNHm52a56PhbCKKbrI3R5Dtr16-rthSIvT-3n_j3N8FSZwSSD1yqG0g/exec";
const POINTS_JSON_URL = "./badge-points-count.json";

const badgeInput = document.getElementById("badgeNo");
const nameInput = document.getElementById("nameHe");
const emailInput = document.getElementById("email");
const publishInput = document.getElementById("publishAllowed");

const checkBtn = document.getElementById("checkBtn");
const resetBtn = document.getElementById("resetBtn");
const updateEmailBtn = document.getElementById("updateEmailBtn");
const submitBtn = document.getElementById("submitBtn");
const deleteRequestBtn = document.getElementById("deleteRequestBtn");
const deleteAllRequestsBtn = document.getElementById("deleteAllRequestsBtn");

const msg = document.getElementById("msg");
const pointsInfo = document.getElementById("pointsInfo");
const publishHint = document.getElementById("publishHint");

const statusSection = document.getElementById("statusSection");
const toggleStatusBtn = document.getElementById("toggleStatusBtn");
const statusTableWrap = document.getElementById("statusTableWrap");
const selectedReqTitle = document.getElementById("selectedReqTitle");
const closeFormBtn = document.getElementById("closeFormBtn");
let refreshStatusBtn = document.getElementById("refreshStatusBtn");
const formBox = document.querySelector(".box");


let selectedInitialPublishAllowed = null;
let requestBusy = false;
let pointsData = {};
let currentBadgeNo = null;
let originalEmail = "";
let formReady = false;
let currentPointCount = 0;
let currentChildCount = 0;
let publishTouched = false;
let currentStatusList = [];
let selectedReqId = null;
let currentRequestMessage = "";

init();

async function init() {
  ensureRefreshStatusButton();
  lockForm();
  await loadPointsJson();
}

async function loadPointsJson() {
  try {
    const res = await fetch(POINTS_JSON_URL);
    pointsData = await res.json();
  } catch (err) {
    showError("שגיאה בטעינת נתוני הנקודות. לא ניתן לשלוח בקשה כרגע.");
    checkBtn.disabled = true;
  }
}

function lockForm() {
  badgeInput.disabled = false;
  checkBtn.disabled = false;

  nameInput.disabled = true;
  emailInput.disabled = true;
  publishInput.disabled = true;
  updateEmailBtn.disabled = true;
  submitBtn.disabled = true;
  deleteRequestBtn.disabled = true;
  deleteAllRequestsBtn.disabled = true;

  nameInput.value = "";
  emailInput.value = "";
  emailInput.placeholder = "";
  publishInput.checked = false;

  pointsInfo.textContent = "";
  publishHint.classList.add("hidden");
  publishHint.textContent = "";

  currentBadgeNo = null;
  originalEmail = "";
  formReady = false;
  currentPointCount = 0;
  currentChildCount = 0;
  publishTouched = false;
  currentStatusList = [];
  statusSection.classList.add("hidden");
  statusTableWrap.classList.add("hidden");
  statusTableWrap.innerHTML = "";
  if (toggleStatusBtn) {
    toggleStatusBtn.textContent = "";
    toggleStatusBtn.classList.add("hidden");
  }
  selectedReqId = null;
  selectedReqTitle.textContent = "";
  closeFormBtn.classList.add("hidden");
  deleteRequestBtn.classList.add("hidden");
  deleteAllRequestsBtn.classList.add("hidden");
  if (refreshStatusBtn) { refreshStatusBtn.classList.add("hidden"); }
  currentRequestMessage = "";
}

checkBtn.addEventListener("click", checkBadge);

badgeInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    checkBadge();
  }
});

resetBtn.addEventListener("click", function () {
  badgeInput.value = "";
  resetBtn.classList.add("hidden");
  checkBtn.classList.remove("hidden");
  clearMsg();
  lockForm();
  badgeInput.focus();
});

emailInput.addEventListener("input", function () {
  updateEmailHint();
  validateReadyToSubmit();
  validateReadyToUpdateEmail();
});


publishInput.addEventListener("change", function () {
  publishTouched = isPublishChanged();
  updatePublishHint();
  validateReadyToSubmit();
});

if (toggleStatusBtn) {
  toggleStatusBtn.classList.add("hidden");
}
closeFormBtn.addEventListener("click", function () {
  window.close();

  if (formBox) {
    formBox.innerHTML = "<h1>הטופס נסגר</h1><div class='msg ok'>אפשר לסגור את הלשונית בדפדפן.</div>";
  }
});

function ensureRefreshStatusButton() {
  if (refreshStatusBtn) {
    return;
  }

  refreshStatusBtn = document.createElement("button");
  refreshStatusBtn.id = "refreshStatusBtn";
  refreshStatusBtn.type = "button";
  refreshStatusBtn.textContent = "רענון סטטוס";
  refreshStatusBtn.classList.add("hidden");

  if (toggleStatusBtn && toggleStatusBtn.parentNode) {
    toggleStatusBtn.parentNode.insertBefore(refreshStatusBtn, toggleStatusBtn.nextSibling);
  } else if (resetBtn && resetBtn.parentNode) {
    resetBtn.parentNode.insertBefore(refreshStatusBtn, resetBtn.nextSibling);
  }
}

async function refreshStatusFromButton() {
  if (!currentBadgeNo || requestBusy) {
    return;
  }

  clearMsg();
  refreshStatusBtn.disabled = true;
  refreshStatusBtn.textContent = "מרענן...";
  refreshStatusBtn.classList.add("busy-blink");

  try {
    await refreshCurrentBadgeStatus(selectedReqId);
    showOk("סטטוס הבקשה רוענן");
  } catch (err) {
    showError("שגיאה ברענון סטטוס: " + (err.message || err));
  } finally {
    refreshStatusBtn.disabled = false;
    refreshStatusBtn.textContent = "רענון סטטוס";
    refreshStatusBtn.classList.remove("busy-blink");
    validateReadyToSubmit();
    validateDeleteButtons();
  }
}

if (refreshStatusBtn) {
  refreshStatusBtn.addEventListener("click", refreshStatusFromButton);
}

deleteRequestBtn.addEventListener("click", async function () {
  const selectedRequest = getSelectedStatusRequest();

  if (!canDeleteSelectedRequest()) {
    showError("אין בקשה פעילה שניתן למחוק.");
    return;
  }

  const approved = confirm(
    "האם למחוק את בקשה מס' " + selectedRequest.reqId + "?\nהבקשה תסומן למחיקה ותטופל בהקדם."
  );

  if (!approved) {
    return;
  }

  await sendDeleteRequest("deleteRequest", {
    selectedReqId: selectedRequest.reqId,
  });
});

deleteAllRequestsBtn.addEventListener("click", async function () {
  if (!canDeleteAnyRequest()) {
    showError("אין בקשות פעילות שניתן למחוק.");
    return;
  }

  const approved = confirm(
    "האם למחוק את כל הבקשות הפעילות של מספר יעל זה?\nבקשות שכבר נמחקו יישארו מוצגות ולא יטופלו שוב."
  );

  if (!approved) {
    return;
  }

  await sendDeleteRequest("deleteAllRequests", {});
});

async function sendDeleteRequest(serverAction, extraPayload) {
  let finalMessage = "";
  let finalError = "";

  clearMsg();
  lockStatusTable();
  validateDeleteButtons();

  deleteRequestBtn.classList.add("busy-blink");
  deleteAllRequestsBtn.classList.add("busy-blink");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(Object.assign({
        action: "saveRequest",
        userAction: "מחיקה",
        badgeNo: currentBadgeNo,
        nameHe: nameInput.value.trim(),
        email: emailInput.value.trim(),
        publishAllowed: publishInput.checked,
        selectedReqId: selectedReqId,
        pointCount: currentPointCount,
        childCount: currentChildCount,
      }, extraPayload || {})),
    });

    const data = await res.json();

    if (!data.ok) {
      finalError = "בקשת המחיקה נכשלה: " + (data.error || data.notifyError || "");
      return;
    }

    await refreshCurrentBadgeStatus(data.reqId);
    finalMessage = data.message || "בקשת המחיקה נשלחה לטיפול";

  } catch (err) {
    finalError = "שגיאה בביצוע המחיקה: " + (err.message || err);
  } finally {
    deleteRequestBtn.classList.remove("busy-blink");
    deleteAllRequestsBtn.classList.remove("busy-blink");
    unlockStatusTable();
    validateReadyToSubmit();
    validateDeleteButtons();

    if (finalError) {
      showError(finalError);
    } else if (finalMessage) {
      showOk(finalMessage);
    }
  }
}

async function checkBadge() {
  const badgeNo = badgeInput.value.trim();

  clearMsg();
  pointsInfo.textContent = "";

  if (!badgeNo) {
    showError("יש להזין מספר יעל");
    return;
  }

  checkBtn.disabled = true;
  checkBtn.textContent = "בודק...";
  checkBtn.classList.add("busy-blink");

  try {
    const userRes = await fetch(
      API_URL + "?badgeNo=" + encodeURIComponent(badgeNo),
    );
    const userData = await userRes.json();

    if (!userData.ok || !userData.found || !userData.person) {
      showError("מספר יעל לא נמצא ברשימה. לא ניתן להמשיך.");
      return;
    }
    currentStatusList = Array.isArray(userData.requestStatusList)
      ? userData.requestStatusList
      : [];

    renderStatusSection();

    // קודם תמיד מציגים את פרטי היעל
    nameInput.value = userData.person.nameHe || "";
    emailInput.value = userData.person.email || "";
    originalEmail = emailInput.value.trim();

    badgeInput.disabled = true;
    checkBtn.classList.add("hidden");
    resetBtn.classList.remove("hidden");
	closeFormBtn.classList.remove("hidden");
    deleteRequestBtn.classList.remove("hidden");
    deleteAllRequestsBtn.classList.add("hidden");
    if (refreshStatusBtn) { refreshStatusBtn.classList.remove("hidden"); }
    validateDeleteButtons();

    emailInput.disabled = false;
    publishInput.disabled = false;
	
	

	const selectedRequest = getSelectedStatusRequest();

	if (selectedRequest && selectedRequest.publishAllowed) {
	  publishInput.checked = selectedRequest.publishAllowed === "כן";
	} else {
	  publishInput.checked = false;
	}

	setSelectedPublishBaseline();

	publishHint.classList.remove("hidden");
	updatePublishHint();

    if (!getSingleRequest() && !emailInput.value.trim()) {
      emailInput.placeholder = "חובה לרשום כתובת מייל תקינה";
    } else {
      emailInput.placeholder = "";
    }

    const points = pointsData[badgeNo];
	const parentCount = points ? Number(points.parent || 0) : 0;
	const childrenCount = points ? Number(points.children || 0) : 0;

	currentPointCount = parentCount;
	currentChildCount = childrenCount;
    // אם אין נקודות — הפרטים נשארים מוצגים, אבל לא מאפשרים שליחה
    if (parentCount === 0 && childrenCount === 0) {
      currentBadgeNo = null;
      pointsInfo.textContent = "לא נמצאו נקודות עבור מספר יעל זה.";
      validateReadyToUpdateEmail();
      submitBtn.disabled = true;
      showError("פרטי היעל נמצאו, אך לא נמצאו נקודות. לא ניתן לשלוח בקשה.");
      return;
    }

    // רק אם יש נקודות — מאפשרים המשך רגיל
    currentBadgeNo = badgeNo;
    applyRequestModeToControls();

    if (childrenCount > 0) {
      pointsInfo.textContent =
        "נמצאו " +
        parentCount +
        " נקודות שלך במפה ועוד " +
        childrenCount +
        " נלווים.";
    } else {
      pointsInfo.textContent = "נמצאו " + parentCount + " נקודות שלך במפה.";
    }

    validateReadyToUpdateEmail();

    showOk(getInitialFoundMessage());

    validateReadyToSubmit();

	} catch (err) {
	  if (currentBadgeNo || nameInput.value.trim()) {
		console.error("post-checkBadge UI error:", err);
		return;
	  }

	  console.error("checkBadge error:", err);
	  showError("שגיאה בבדיקת מספר יעל: " + (err.message || err));
	}
	
   finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "בדיקה";
	checkBtn.classList.remove("busy-blink");
  }
}
updateEmailBtn.addEventListener("click", async function () {
  const email = emailInput.value.trim();

  if (!currentBadgeNo || !isValidEmail(email)) {
    showError("יש לרשום כתובת מייל תקינה לפני עדכון");
    return;
  }

  updateEmailBtn.disabled = true;
  updateEmailBtn.textContent = "מעדכן...";
  updateEmailBtn.classList.add("busy-blink");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateEmail",
        badgeNo: currentBadgeNo,
        email: email,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      showError("עדכון האימייל נכשל: " + (data.error || ""));
      return;
    }

    originalEmail = email;
    showOk("האימייל עודכן ברשימה");
  } catch (err) {
    showError("שגיאה בעדכון האימייל: " + (err.message || err));
  } finally {
    validateReadyToUpdateEmail();
    updateEmailBtn.textContent = "עדכון אימייל";
	updateEmailBtn.classList.remove("busy-blink");
    validateReadyToSubmit();
  }
});
submitBtn.addEventListener("click", async function () {
  validateReadyToSubmit();

  if (!formReady) {
    showError("אין שינוי שמצריך שליחה או עדכון");
    return;
  }

  const email = emailInput.value.trim();
  const baseText = getSubmitButtonBaseText();
  let finalMessage = "";
  let finalError = "";

  clearMsg();

  submitBtn.disabled = true;
  submitBtn.textContent = baseText + "...";
  submitBtn.classList.add("busy-blink");
  lockStatusTable();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "saveRequest",
        userAction: getNextUserAction(),
        badgeNo: currentBadgeNo,
        nameHe: nameInput.value.trim(),
        email: email,
        publishAllowed: publishInput.checked,
        publishTouched: isPublishChanged(),
        selectedReqId: selectedReqId,
        pointCount: currentPointCount,
        childCount: currentChildCount,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      finalError = baseText + " נכשלה: " + (data.error || data.notifyError || "");
      return;
    }

    await refreshCurrentBadgeStatus(data.reqId);
    finalMessage = data.message || "הבקשה טופלה בהצלחה";

  } catch (err) {
    finalError = "שגיאה בביצוע הפעולה: " + (err.message || err);
  } finally {
    submitBtn.classList.remove("busy-blink");
    unlockStatusTable();
    validateReadyToSubmit();

    if (finalError) {
      showError(finalError);
    } else if (finalMessage) {
      showOk(finalMessage);
    }
  }
});

function getInitialFoundMessage() {
  const request = getSingleRequest();

  if (isDeletedRequest(request) || isDeletingRequest(request)) {
    return "הפרטים נמצאו, ניתן לשחזר את הבקשה.";
  }

  if (!request && !emailInput.value.trim()) {
    return "הפרטים נמצאו. יש להשלים אימייל כדי לשלוח בקשה.";
  }

  if (!request) {
    return "הפרטים נמצאו. ניתן לשלוח בקשה.";
  }

  if (isPendingRequest(request)) {
    return "הפרטים נמצאו. הבקשה בטיפול. ניתן לעדכן הפצה או לרענן סטטוס.";
  }

  return "הפרטים נמצאו. ניתן לעדכן את הבקשה.";
}

function validateReadyToSubmit() {
  const email = emailInput.value.trim();
  const actionNeeded = hasSubmitActionNeeded();

  formReady =
    currentBadgeNo !== null &&
    nameInput.value.trim() !== "" &&
    isValidEmail(email) &&
    actionNeeded &&
    !requestBusy;

  submitBtn.disabled = !formReady;
  publishInput.disabled = !canEditPublish();
  validateDeleteButtons();

  // אין לנעול את טבלת הבקשות רק בגלל שינוי ממתין.
  // הטבלה ננעלת רק בזמן פעולה ממשית מול השרת: שמירה / עדכון / מחיקה.
  if (!requestBusy) {
    unlockStatusTableForPendingUpdate();
  }

  if (!submitBtn.classList.contains("busy-blink")) {
    updateSubmitButtonText();
  }
}

function validateDeleteButtons() {
  if (!deleteRequestBtn || !deleteAllRequestsBtn) {
    return;
  }

  deleteRequestBtn.disabled = !canDeleteSelectedRequest();
  deleteAllRequestsBtn.disabled = true;
  deleteAllRequestsBtn.classList.add("hidden");
}

function applyRequestModeToControls() {
  const request = getSingleRequest();

  publishInput.disabled = !canEditPublish();

  if (!request) {
    currentRequestMessage = "ניתן לשלוח בקשה חדשה.";
  } else if (isPendingRequest(request)) {
    currentRequestMessage = "הבקשה בטיפול. ניתן לעדכן את אישור ההפצה בלבד ולרענן סטטוס.";
  } else if (isDeletedRequest(request) || isDeletingRequest(request)) {
    currentRequestMessage = "הבקשה מחוקה או בתהליך מחיקה. ניתן לשחזר אותה.";
  } else if (isActiveFinalRequest(request)) {
    currentRequestMessage = "הבקשה פעילה. ניתן לעדכן הפצה או למחוק.";
  } else {
    currentRequestMessage = "סטטוס הבקשה אינו מוכר. מומלץ לרענן.";
  }

  if (publishHint && currentRequestMessage) {
    publishHint.classList.remove("hidden");
  }
}

function getRequestModeMessage() {
  return currentRequestMessage || "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
