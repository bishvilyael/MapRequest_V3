function buildStatusTableHtml(list) {
  if (!list || list.length === 0) {
    return "";
  }

  let html = "";

  html += '<table class="status-table">';
  html += "<thead>";
  html += "<tr>";
  html += "<th>בקשה</th>";
  html += "<th>פעולה</th>";
  html += "<th>סטטוס</th>";
  html += "<th>הפצה</th>";
  html += "<th>נקודות</th>";
  html += "<th>נלווים</th>";
  html += "<th>תאריך בקשה</th>";
  html += "<th>תאריך עדכון</th>";
  html += "<th>תאריך סיום</th>";
  html += "<th>קישור</th>";
  html += "</tr>";
  html += "</thead>";

  html += "<tbody>";

  list.forEach(function (r) {
    const deletedClass = (isDeletingRequest(r) || isDeletedRequest(r)) ? " deleted-status-row" : "";
    const selectedClass =
      String(r.reqId) === String(selectedReqId) ? " selected-status-row" : "";

    html +=
      '<tr class="status-row' +
      deletedClass +
      selectedClass +
      '" onclick="selectStatusRequest(\'' +
      escapeAttr(r.reqId || "") +
      '\')">';

    html += "<td>" + escapeHtml(r.reqId || "") + "</td>";
    html += "<td>" + escapeHtml(r.action || r.Action || "") + "</td>";
    html += "<td>" + escapeHtml(r.status || "") + "</td>";
    html += "<td>" + escapeHtml(r.publishAllowed || "") + "</td>";
    html += "<td>" + escapeHtml(r.pointCount || "") + "</td>";
    html += "<td>" + escapeHtml(r.childCount || "") + "</td>";
    html += "<td>" + escapeHtml(r.reqDate || "") + "</td>";
    html += "<td>" + escapeHtml(r.reqUpdate || "") + "</td>";
    html += "<td>" + escapeHtml(r.reqComp || "") + "</td>";

    if (r.mapUrl && !isDeletingRequest(r) && !isDeletedRequest(r)) {
      html +=
        '<td><a href="' +
        escapeAttr(r.mapUrl) +
        '" target="_blank" rel="noopener">פתח מפה</a></td>';
    } else {
      html += "<td></td>";
    }

    html += "</tr>";
  });

  html += "</tbody>";
  html += "</table>";

  return html;
}

function getSelectedStatusRequest() {
  if (!selectedReqId || !currentStatusList || currentStatusList.length === 0) {
    return null;
  }

  return (
    currentStatusList.find(function (r) {
      return String(r.reqId) === String(selectedReqId);
    }) || null
  );
}

function selectStatusRequest(reqId) {
  if (requestBusy) {
    return;
  }

  selectedReqId = reqId;
  updateSelectedReqTitle();

  const selectedRequest = getSelectedStatusRequest();

  if (selectedRequest) {
    publishInput.checked = getSelectedRequestPublishAllowed();
    setSelectedPublishBaseline();
    applyRequestModeToControls();
    updatePublishHint();
  }

  statusTableWrap.innerHTML = buildStatusTableHtml(currentStatusList);
  validateReadyToSubmit();
  validateDeleteButtons();
}

function updateSelectedReqTitle() {
  if (selectedReqId) {
    selectedReqTitle.textContent = "(בקשה מס' " + selectedReqId + ")";
  } else {
    selectedReqTitle.textContent = "";
  }
}

function renderStatusSection(preferredReqId) {
  if (currentStatusList.length > 0) {
    const preferredRequest =
      preferredReqId
        ? currentStatusList.find(function (r) {
            return String(r.reqId) === String(preferredReqId);
          })
        : null;

    selectedReqId =
      (preferredRequest && preferredRequest.reqId) ||
      getDefaultSelectableReqId();

    statusSection.classList.remove("hidden");
    if (toggleStatusBtn) {
      toggleStatusBtn.classList.add("hidden");
    }

    statusTableWrap.classList.remove("hidden");
    statusTableWrap.innerHTML = buildStatusTableHtml(currentStatusList);

    updateSelectedReqTitle();

    const selectedRequest = getSelectedStatusRequest();

    if (selectedRequest) {
      publishInput.checked = selectedRequest.publishAllowed === "כן";
    } else {
      publishInput.checked = false;
    }

    setSelectedPublishBaseline();
    applyRequestModeToControls();
    updatePublishHint();
    validateDeleteButtons();
  } else {
    selectedReqId = null;
    updateSelectedReqTitle();

    statusSection.classList.add("hidden");
    toggleStatusBtn.classList.add("hidden");
    statusTableWrap.classList.add("hidden");
    statusTableWrap.innerHTML = "";
    applyRequestModeToControls();
    validateDeleteButtons();
  }
}

async function refreshCurrentBadgeStatus(preferredReqId) {
  if (!currentBadgeNo) {
    return;
  }

  const res = await fetch(
    API_URL + "?badgeNo=" + encodeURIComponent(currentBadgeNo)
  );

  const userData = await res.json();

  currentStatusList = Array.isArray(userData.requestStatusList)
    ? userData.requestStatusList
    : [];

  renderStatusSection(preferredReqId);
}
