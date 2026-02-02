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

export let bridgeId;
export let obsPort;

export let connections = [];
export let obs = new Obs();
export let relay = new Relay(connections, RelayStatus.Connecting);

let timerId;

export function reset(delayMs = 0) {
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

function populateRemoteControllerSetup() {
  const url = `${wsScheme}://${baseUrl}/remote-controller/${bridgeId}`;
  const obsBladeHostname = `${baseUrl}/remote-controller/${bridgeId}`;

  document.getElementById("moblinUrl").value = url;
  document.getElementById("obsBladeHost").value = url;
  document.getElementById("obsBladeHostname").value = obsBladeHostname;
}

function populateSettings() {
  document.getElementById("obsPort").value = obsPort;
  document.getElementById("bridgeId").value = bridgeId;
}

function populateStatusPage() {
  const statusPageUrl = `${httpScheme}://${baseUrl}/status.html?bridgeId=${bridgeId}`;
  document.getElementById("statusPageUrl").value = statusPageUrl;
}

function saveSettings() {
  obsPort = document.getElementById("obsPort").value;
  bridgeId = document.getElementById("bridgeId").value;

  localStorage.setItem("obsPort", obsPort);
  localStorage.setItem("bridgeId", bridgeId);

  populateRemoteControllerSetup();
  populateStatusPage();
  reset();

  obs.retry();
}

function resetSettings() {
  bridgeId = randomUUID();
  localStorage.setItem("bridgeId", bridgeId);

  obsPort = defaultObsPort;
  localStorage.setItem("obsPort", obsPort);

  populateRemoteControllerSetup();
  populateSettings();
  populateStatusPage();
  reset();

  obs.retry();
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

window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);

  addOnClick("saveSettings", saveSettings);
  addOnClick("resetSettings", resetSettings);

  loadbridgeId(urlParams);
  loadObsPort(urlParams);

  relay.setupControlWebsocket();
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

document.querySelectorAll("[data-toggle-show]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget;
    const inputId = currentTarget.getAttribute("aria-controls");

    const icon = currentTarget.querySelector("i");
    const input = document.getElementById(inputId);

    if (input.type === "password") {
      input.type = "text";
      icon.classList.add("p-icon--hide");
      icon.classList.remove("p-icon--show");
    } else {
      input.type = "password";
      icon.classList.add("p-icon--show");
      icon.classList.remove("p-icon--hide");
    }
  });
});

document.querySelectorAll("[data-copy-to-clipboard]").forEach((element) => {
  element.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget;
    const inputId = currentTarget.getAttribute("data-copy-to-clipboard");
    const input = document.getElementById(inputId);

    await navigator.clipboard.writeText(input.value);

    currentTarget.innerHTML = "Copied";
    setTimeout(() => {
      currentTarget.innerHTML = "Copy";
    }, 2000);
  });
});
