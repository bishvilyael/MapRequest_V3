function updateEmailHint() {
  const email = emailInput.value.trim();

  if (!email) {
    clearMsg();
    emailInput.title = "יש להזין כתובת אימייל";
    return;
  }

  if (!isValidEmail(email)) {
    emailInput.title = "כתובת האימייל אינה תקינה. יש להזין כתובת במבנה name@example.com";
    showError("כתובת האימייל אינה תקינה. יש לתקן אותה כדי להמשיך.");
    return;
  }

  emailInput.title = "";

  if (msg.classList.contains("error")) {
    clearMsg();
  }
}

function validateReadyToUpdateEmail() {
  const email = emailInput.value.trim();

  updateEmailBtn.disabled =
    !currentBadgeNo ||
    !isValidEmail(email) ||
    email === originalEmail;
}
