function updatePublishHint() {
  if (publishInput.checked) {
    publishHint.textContent = "המפה תוכל להופיע באתר המפות האישיות";
    publishHint.className = "publish-hint ok";
  } else {
    publishHint.textContent = "קישור למפה ישלח רק אליך";
    publishHint.className = "publish-hint warn";
  }
}

function showOk(text) {
  msg.innerHTML = text;
  msg.className = "msg ok";
}

function showError(text) {
  msg.textContent = text;
  msg.className = "msg error";
}

function clearMsg() {
  msg.textContent = "";
  msg.className = "msg";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function lockStatusTableForPendingUpdate() {
  if (!currentStatusList || currentStatusList.length === 0) {
    return;
  }

  statusTableWrap.style.pointerEvents = "none";
  statusTableWrap.style.opacity = "0.55";
}

function unlockStatusTableForPendingUpdate() {
  if (requestBusy) {
    return;
  }

  statusTableWrap.style.pointerEvents = "";
  statusTableWrap.style.opacity = "";
}

function lockStatusTable() {
  requestBusy = true;
  statusTableWrap.style.pointerEvents = "none";
  statusTableWrap.style.opacity = "0.55";
}

function unlockStatusTable() {
  requestBusy = false;
  statusTableWrap.style.pointerEvents = "";
  statusTableWrap.style.opacity = "";
}