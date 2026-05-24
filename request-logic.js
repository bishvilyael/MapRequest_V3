function getSingleRequest() {
  if (!currentStatusList || currentStatusList.length === 0) {
    return null;
  }
  return currentStatusList[0] || null;
}

function getSubmitButtonBaseText() {
  const request = getSingleRequest();
  const action = getNextUserAction();

  if (request && normalizeAction(request.action) === "שחזור") {
    return "עדכון בקשה";
  }

  switch (action) {
    case "יצירה":
      return "שליחת בקשה";
    case "עדכון":
      return "עדכון בקשה";
    case "שחזור":
      return "שחזור בקשה";
    default:
      return "שליחת בקשה";
  }
}

function updateSubmitButtonText() {
  submitBtn.textContent = getSubmitButtonBaseText();
}

function normalizeStatus(value) {
  return String(value || "").trim();
}

function normalizeAction(value) {
  return String(value || "").trim();
}

function isFinalAction(action) {
  return normalizeAction(action) === "-";
}

function isPendingRequest(request) {
  return request && normalizeStatus(request.status) === "בטיפול" && !isFinalAction(request.action);
}

function isDeletedRequest(request) {
  const action = normalizeAction(request && (request.action || request.Action));
  const status = normalizeStatus(request && request.status);

  // תומך גם במודל החדש: Action=-, Status=נמחק
  // וגם במצב מחיקה ממתין: Action=מחיקה, Status=בטיפול
  return request && (
    status === "נמחק" ||
    action === "מחיקה"
  );
}

function isActiveFinalRequest(request) {
  const status = normalizeStatus(request && request.status);
  return request && isFinalAction(request.action) && ["נוצר", "עודכן", "שוחזר", "הושלם"].indexOf(status) >= 0;
}

function isDeletingRequest(request) {
  return request && normalizeAction(request.action || request.Action) === "מחיקה";
}

function getActiveStatusList() {
  // תאימות לקוד הישן. במודל החדש הרשימה כוללת לכל היותר בקשה אחת.
  return currentStatusList || [];
}

function hasActiveRequests() {
  return !!getSingleRequest();
}

function getDefaultSelectableReqId() {
  const request = getSingleRequest();
  return request ? request.reqId || null : null;
}

function getSelectedRequestPublishAllowed() {
  const selectedRequest = getSelectedStatusRequest();

  if (!selectedRequest) {
    return false;
  }

  return String(selectedRequest.publishAllowed || "").trim() === "כן";
}

function setSelectedPublishBaseline() {
  selectedInitialPublishAllowed = publishInput.checked;
  publishTouched = false;
}

function isPublishChanged() {
  if (selectedInitialPublishAllowed === null) {
    return false;
  }

  return publishInput.checked !== selectedInitialPublishAllowed;
}

function isCountsChangedFromSelectedRequest() {
  const selectedRequest = getSelectedStatusRequest();

  if (!selectedRequest) {
    return false;
  }

  return (
    Number(selectedRequest.pointCount || 0) !== Number(currentPointCount || 0) ||
    Number(selectedRequest.childCount || 0) !== Number(currentChildCount || 0)
  );
}

function isNewRequestMode() {
  return !getSingleRequest();
}

function getNextUserAction() {
  const request = getSingleRequest();

  if (!request) {
    return "יצירה";
  }

  if (isDeletedRequest(request)) {
    return "שחזור";
  }

  if (isPendingRequest(request)) {
    // שינוי הפצה בבקשה שכבר בטיפול לא מחליף את הפעולה המקורית.
    return normalizeAction(request.action) || "עדכון";
  }

  if (isActiveFinalRequest(request)) {
    return "עדכון";
  }

  // ברירת מחדל שמרנית.
  return "עדכון";
}

function canEditPublish() {
  const request = getSingleRequest();
  return !isDeletedRequest(request) && currentBadgeNo !== null && !requestBusy;
}

function hasSubmitActionNeeded() {
  if (!currentBadgeNo) {
    return false;
  }

  const request = getSingleRequest();

  if (!request) {
    return true;
  }

  if (isDeletedRequest(request)) {
    return true; // שחזור
  }

  if (isPendingRequest(request)) {
    return isPublishChanged();
  }

  if (isActiveFinalRequest(request)) {
    return isPublishChanged() || isCountsChangedFromSelectedRequest();
  }

  return false;
}

function canDeleteSelectedRequest() {
  const selectedRequest = getSelectedStatusRequest();
  const email = emailInput ? emailInput.value.trim() : "";

  return (
    currentBadgeNo !== null &&
    selectedRequest !== null &&
    isValidEmail(email) &&
    !isDeletedRequest(selectedRequest) &&
    !isDeletingRequest(selectedRequest) &&
    !requestBusy
  );
}

function canDeleteAnyRequest() {
  return canDeleteSelectedRequest();
}
