import Obs from "./classes/Obs.mjs";
import Relay from "./classes/Relay.mjs";
import {
  addOnClick,
  appendToRow,
  baseUrl,
  bitrateToString,
  getTableBody,
  httpScheme,
  randomUUID,
  timeAgoString,
  wsScheme,
} from "./utils.mjs";

export const RelayStatus = {
  Connecting: "Connecting...",
  Connected: "Connected",
  Kicked: "Kicked",
};

export const ObsStatus = {
  Connecting: "Connecting...",
  Connected: "Connected",
};

export const ConnectionStatus = {
  ConnectingToRelay: "Connecting to Relay...",
  ConnectingToObs: "Connecting to OBS on this computer...",
  ObsClosed: "OBS connection closed",
  ObsError: "OBS connection error",
  Connected: "Connected",
  RemoteControllerClosed: "Remote controller connection closed",
  RemoteControllerError: "Remote controller connection error",
  RateLimitExceeded: "Rate limit exceeded",
};

const defaultObsPort = "4455";

export let bridgeId = undefined;
export let obsPort = undefined;
export let timerId = undefined;

export let obs = undefined;
export let relay = undefined;
export let connections = [];

export function reset(delayMs) {
  for (const connection of connections) {
    connection.close();
  }
  connections = [];
  relay.close();
  relay = new Relay();
  if (timerId != undefined) {
    clearTimeout(timerId);
  }
  timerId = setTimeout(() => {
    timerId = undefined;
    relay.setupControlWebsocket();
  }, delayMs);
}

function makeMoblinRemoteControllerUrl() {
  return `${wsScheme}://${baseUrl}/remote-controller/${bridgeId}`;
}

function makeObsBladeHostnameRemoteControllerUrl() {
  return `${baseUrl}/remote-controller/${bridgeId}`;
}

function copyMoblinRemoteControllerUrlToClipboard() {
  navigator.clipboard.writeText(makeMoblinRemoteControllerUrl());
}

function copyObsBladeHostnameRemoteControllerUrlToClipboard() {
  navigator.clipboard.writeText(makeObsBladeHostnameRemoteControllerUrl());
}

function makeStatusPageUrl() {
  return `${httpScheme}://${baseUrl}/status.html?bridgeId=${bridgeId}`;
}

function copyStatusPageUrlToClipboard() {
  navigator.clipboard.writeText(makeStatusPageUrl());
}

function toggleShow(inputId, iconId) {
  let input = document.getElementById(inputId);
  let icon = document.getElementById(iconId);
  if (input.type === "password") {
    input.type = "text";
    icon.classList.add("p-icon--hide");
    icon.classList.remove("p-icon--show");
  } else {
    input.type = "password";
    icon.classList.add("p-icon--show");
    icon.classList.remove("p-icon--hide");
  }
}

function toggleShowMoblinRemoteControllerMoblinUrl() {
  toggleShow("moblinUrl", "moblinUrlIcon");
}

function toggleShowMoblinRemoteControllerObsBladeHostname() {
  toggleShow("obsBladeHostname", "obsBladeHostnameIcon");
}

function toggleShowMoblinRemoteControllerObsBladeHost() {
  toggleShow("obsBladeHost", "obsBladeHostIcon");
}

function toggleShowStatusPageUrl() {
  toggleShow("statusPageUrl", "statusPageUrlIcon");
}

function populateRemoteControllerSetup() {
  document.getElementById("moblinUrl").value = makeMoblinRemoteControllerUrl();
  document.getElementById("obsBladeHostname").value =
    makeObsBladeHostnameRemoteControllerUrl();
  document.getElementById("obsBladeHost").value =
    makeMoblinRemoteControllerUrl();
}

function populateSettings() {
  document.getElementById("obsPort").value = obsPort;
  document.getElementById("bridgeId").value = bridgeId;
}

function populateStatusPage() {
  document.getElementById("statusPageUrl").value = makeStatusPageUrl();
}

function saveSettings() {
  obsPort = document.getElementById("obsPort").value;
  localStorage.setItem("obsPort", obsPort);
  bridgeId = document.getElementById("bridgeId").value;
  localStorage.setItem("bridgeId", bridgeId);
  populateRemoteControllerSetup();
  populateStatusPage();
  reset(0);
  obs.retry(0);
}

function resetSettings() {
  bridgeId = randomUUID();
  localStorage.setItem("bridgeId", bridgeId);
  obsPort = defaultObsPort;
  localStorage.setItem("obsPort", obsPort);
  populateRemoteControllerSetup();
  populateSettings();
  populateStatusPage();
  reset(0);
  obs.retry(0);
}

function updateConnections() {
  let body = getTableBody("connections");
  for (const connection of connections) {
    let row = body.insertRow(-1);
    let statusWithIcon = `<i class="p-icon--spinner u-animation--spin"></i> ${connection.status}`;
    if (connection.status == connectionStatusConnected) {
      statusWithIcon = `<i class="p-icon--success"></i> ${connection.status}`;
    } else if (connection.isAborted()) {
      statusWithIcon = `<i class="p-icon--error"></i> ${connection.status}`;
    }
    appendToRow(row, statusWithIcon);
    appendToRow(row, timeAgoString(connection.statusUpdateTime));
    appendToRow(row, bitrateToString(connection.bitrateToRemoteController));
    appendToRow(row, bitrateToString(connection.bitrateToObs));
  }
}

function updateStatus() {
  if (!relay.statusEnabled) {
    return;
  }
  let status = {
    connections: [],
  };
  for (const connection of connections) {
    status.connections.push({
      status: connection.status,
      aborted: connection.isAborted(),
      statusUpdateTime: connection.statusUpdateTime,
      bitrateToRemoteController: connection.bitrateToRemoteController,
      bitrateToObs: connection.bitrateToObs,
    });
  }
  relay.sendStatus(status);
}

export function updateRelayStatus() {
  let relayStatus = '<i class="p-icon--error"></i> Unknown server status';
  if (relay.status == RelayStatus.Connecting) {
    relayStatus =
      '<i class="p-icon--spinner u-animation--spin"></i> Connecting to server';
  } else if (relay.status == RelayStatus.Connected) {
    relayStatus = '<i class="p-icon--success"></i> Connected to server';
  } else if (relay.status == RelayStatus.Kicked) {
    relayStatus = '<i class="p-icon--error"></i> Kicked by server';
  }
  document.getElementById("relayStatus").innerHTML = relayStatus;
}

export function updateObsStatus() {
  let obsStatus = '<i class="p-icon--error"></i> Unknown OBS status';
  if (obs.status == ObsStatus.Connecting) {
    obsStatus =
      '<i class="p-icon--spinner u-animation--spin"></i> Connecting to OBS on this computer (may take up to a minute)';
  } else if (obs.status == ObsStatus.Connected) {
    obsStatus =
      '<i class="p-icon--success"></i> Connected to OBS on this computer';
  }
  document.getElementById("obsStatus").innerHTML = obsStatus;
}

function toggleShowBridgeId() {
  let bridgeIdInput = document.getElementById("bridgeId");
  let bridgeIdText = document.getElementById("bridgeIdText");
  let bridgeIdIcon = document.getElementById("bridgeIdIcon");
  if (bridgeIdInput.type === "password") {
    bridgeIdInput.type = "text";
    bridgeIdText.innerText = "Hide";
    bridgeIdIcon.classList.add("p-icon--hide");
    bridgeIdIcon.classList.remove("p-icon--show");
  } else {
    bridgeIdInput.type = "password";
    bridgeIdText.innerText = "Show";
    bridgeIdIcon.classList.add("p-icon--show");
    bridgeIdIcon.classList.remove("p-icon--hide");
  }
}

function loadbridgeId(urlParams) {
  bridgeId = urlParams.get("bridgeId");
  if (bridgeId == undefined) {
    bridgeId = localStorage.getItem("bridgeId");
  }
  if (bridgeId == undefined) {
    bridgeId = randomUUID();
  }
  localStorage.setItem("bridgeId", bridgeId);
}

function loadObsPort(urlParams) {
  obsPort = urlParams.get("obsPort");
  if (obsPort == undefined) {
    obsPort = localStorage.getItem("obsPort");
  }
  if (obsPort == undefined) {
    obsPort = defaultObsPort;
  }
  localStorage.setItem("obsPort", obsPort);
}

window.addEventListener("DOMContentLoaded", async (event) => {
  addOnClick(
    "toggleShowMoblinRemoteControllerMoblinUrl",
    toggleShowMoblinRemoteControllerMoblinUrl
  );
  addOnClick(
    "copyMoblinRemoteControllerUrlToClipboard",
    copyMoblinRemoteControllerUrlToClipboard
  );
  addOnClick(
    "toggleShowMoblinRemoteControllerObsBladeHostname",
    toggleShowMoblinRemoteControllerObsBladeHostname
  );
  addOnClick(
    "copyObsBladeHostnameRemoteControllerUrlToClipboard",
    copyObsBladeHostnameRemoteControllerUrlToClipboard
  );
  addOnClick(
    "toggleShowMoblinRemoteControllerObsBladeHost",
    toggleShowMoblinRemoteControllerObsBladeHost
  );
  addOnClick(
    "copyMoblinRemoteControllerUrlToClipboard",
    copyMoblinRemoteControllerUrlToClipboard
  );
  addOnClick("toggleShowBridgeId", toggleShowBridgeId);
  addOnClick("saveSettings", saveSettings);
  addOnClick("toggleShowStatusPageUrl", toggleShowStatusPageUrl);
  addOnClick("copyStatusPageUrlToClipboard", copyStatusPageUrlToClipboard);
  addOnClick("resetSettings", resetSettings);
  const urlParams = new URLSearchParams(window.location.search);
  loadbridgeId(urlParams);
  loadObsPort(urlParams);
  relay = new Relay(connections, RelayStatus.Connecting);
  relay.setupControlWebsocket();
  obs = new Obs();
  obs.setupWebsocket();
  populateRemoteControllerSetup();
  populateSettings();
  populateStatusPage();
  updateConnections();
  updateRelayStatus();
  updateObsStatus();
  setInterval(() => {
    for (const connection of connections) {
      connection.updateBitrates();
    }
    updateConnections();
    updateStatus();
  }, 1000);
});
