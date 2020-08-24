"use strict";

// Clean-up function:
// collect garbage before unloading browser's window
// window.onbeforeunload = function (e) {
//   hangup();
// };

// Data channel information
var sendChannel, receiveChannel, sendChannel2, receiveChannel2;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");
// var sendTextarea2 = document.getElementById("dataChannelSend2");
var receiveTextarea2 = document.getElementById("dataChannelReceive2");

// HTML5 <video> elements
var localVideo = document.querySelector("#video1");
var remoteVideo = document.querySelector("#video2");
var remoteVideo2 = document.querySelector("#video3");

// Handler associated with 'Send' button
sendButton.onclick = sendData;

// Flags...
var isChannelReady;
var isChannelReady2;
var isInitiator;
var isStarted;
var isPc2;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
var remoteStream2;
// Peer Connection
var pc;
var pc2;

/////////////////////////////////////////////

// Let's get started: prompt user for input (room name)
var room = prompt("Enter room name:");

// Connect to signalling server
var socket = io.connect();

// Send 'Create or join' message to signalling server
if (room !== "") {
  console.log("Create or join room", room);
  socket.emit("create or join", room);
}

// Set getUserMedia constraints
var constraints = { audio: false, video: true };

// Call getUserMedia()
// navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
navigator.mediaDevices
  .getUserMedia(constraints)
  .then(handleUserMedia)
  .catch(handleUserMediaError);
console.log("Getting user media with constraints", constraints);

// From this point on, execution proceeds based on asynchronous events...

/////////////////////////////////////////////

// getUserMedia() handlers...
/////////////////////////////////////////////
function handleUserMedia(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  console.log("Adding local stream.");
  sendMessage("got user media");
  if (isInitiator) {
    checkAndStart();
  }
}

function handleUserMediaError(error) {
  console.log("navigator.getUserMedia error: ", error);
}
/////////////////////////////////////////////

// Server-mediated message exchanging...
/////////////////////////////////////////////

// 1. Server-->Client...
/////////////////////////////////////////////

// Handle 'created' message coming back from server:
// this peer is the initiator
socket.on("created", function (room) {
  console.log("Created room " + room);
  isInitiator = true;
});

// Handle 'full' message coming back from server:
// this peer arrived too late :-(
socket.on("full", function (room) {
  console.log("Room " + room + " is full");
});

// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on("join", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isChannelReady = true;
});

socket.on("join 2", function (room) {
  console.log("Another peer made a request to join room " + room);
  console.log("This peer is the initiator of room " + room + "!");
  isPc2 = true;
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on("joined", function (room) {
  console.log("This peer has joined room " + room);
  isChannelReady = true;
});

// Handle third peer/2nd Client
socket.on("joined 2", function (room) {
  console.log("This peer has joined room " + room);
  isPc2 = true;
});

// Server-sent log message...
socket.on("log", function (array) {
  console.log.apply(console, array);
});

// Receive message from the other peer via the signalling server
socket.on("message", function (message) {
  console.log("Received message:", message);
  if (message === "got user media") {
    checkAndStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      checkAndStart();
    }
    if (isPc2) {
      console.log("offer: pc2.setRemoteDescription called");
      pc2.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer2();
    }
    else {
      console.log("offer: pc.setRemoteDescription called");
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    }
  } else if (message.type === "answer" && isStarted) {
    if (isPc2) {
      console.log("answer: pc2.setRemoteDescription called");
      pc2.setRemoteDescription(new RTCSessionDescription(message));
    }
    else {
      console.log("answer: pc.setRemoteDescription called");
      pc.setRemoteDescription(new RTCSessionDescription(message));
    }
  } else if (message.type === "candidate" && isStarted) {
    if (isPc2) {
      console.log("var candidate2 = new RTCIceCandidate({ called");
      var candidate2 = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc2.addIceCandidate(candidate2);
    }
    else {
      console.log("var candidate = new RTCIceCandidate({ called");
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc.addIceCandidate(candidate);
    }
  } else if (message === "bye" && isStarted) {
    handleRemoteHangup();
  }
});
////////////////////////////////////////////////

// 2. Client-->Server
////////////////////////////////////////////////
// Send message to the other peer via the signalling server
function sendMessage(message) {
  console.log("Sending message: ", message);
  socket.emit("message", message);
}
////////////////////////////////////////////////////

////////////////////////////////////////////////////
// Channel negotiation trigger function
function checkAndStart() {
  console.log("checkAndStart() called");
  if (!isStarted && typeof localStream != "undefined" && isChannelReady) {
    console.log("normal checkAndStart() chosen");
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }

  if (typeof localStream != "undefined" && isPc2) {
    console.log("checkAndStart() 2 chosen");
    createPeerConnection2();
    pc2.addStream(localStream);
    if (isInitiator) {
      doCall2();
    }
  }
}

/////////////////////////////////////////////////////////
// Peer Connection management...
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection();
    pc.onicecandidate = handleIceCandidate;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
  pc.ontrack = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;
  }

if (isInitiator) {
  try {
    // Create a reliable data channel
    sendChannel = pc.createDataChannel("sendDataChannel");
    trace("Created send data channel");
  } catch (e) {
    alert("Failed to create data channel. ");
    trace("createDataChannel() failed with exception: " + e.message);
  }
  sendChannel.onopen = handleSendChannelStateChange;
  sendChannel.onmessage = handleMessage;
  sendChannel.onclose = handleSendChannelStateChange;
} else {
  // Joiner
  // pc.ondatachannel = gotReceiveChannel;
}

function createPeerConnection2() {
  console.log("createPeerConnection2() called");
  try {
    pc2 = new RTCPeerConnection();
    pc2.onicecandidate = handleIceCandidate2;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
  pc2.ontrack = handleRemoteStreamAdded2;
  pc2.onremovestream = handleRemoteStreamRemoved2;
}

// if (isInitiator) {
//   try {
//     // Create a reliable data channel
//     sendChannel2 = pc2.createDataChannel("sendDataChannel");
//     trace("Created send data channel");
//   } catch (e) {
//     alert("Failed to create data channel. ");
//     trace("createDataChannel() failed with exception: " + e.message);
//   }
//   sendChannel2.onopen = handleSendChannelStateChange2;
//   sendChannel2.onmessage = handleMessage2;
//   sendChannel2.onclose = handleSendChannelStateChange2;
// } else {
//   // Joiner
//   // pc2.ondatachannel = gotReceiveChannel2;
// }

// Data channel management
function sendData() {
var data = sendTextarea.value;
if (isInitiator) sendChannel.send(data);
else receiveChannel.send(data);
trace("Sent data: " + data);
}

// Handlers...

function gotReceiveChannel(event) {
  trace("Receive Channel Callback");
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  trace("Received message: " + event.data);
  receiveTextarea.value += event.data + "\n";
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace("Send channel state is: " + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace("Receive channel state is: " + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

// ICE candidates management
function handleIceCandidate(event) {
  console.log("handleIceCandidate event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
}

// Create Offer
function doCall() {
  console.log("Creating Offer...");
  pc.createOffer(setLocalAndSendMessage, onSignalingError);
}

// Signalling error handler
function onSignalingError(error) {
  console.log("Failed to create signaling message : " + error.name);
}

// Create Answer
function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer(setLocalAndSendMessage, onSignalingError);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function handleRemoteStreamAdded(event) {
  console.log("Remote stream added.");
  remoteVideo.srcObject = event.stream;
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log("Remote stream removed. Event: ", event);
}
/////////////////////////////////////////////////////////

// Handlers 2...

function gotReceiveChannel2(event) {
  trace("Receive Channel Callback 2");
  receiveChannel2 = event.channel;
  receiveChannel2.onmessage = handleMessage2;
  receiveChannel2.onopen = handleReceiveChannelStateChange2;
  receiveChannel2.onclose = handleReceiveChannelStateChange2;
}

function handleMessage2(event) {
  trace("Received message 2: " + event.data);
  receiveTextarea2.value += event.data + "\n";
}

// function handleSendChannelStateChange2() {
//   var readyState2 = sendChannel2.readyState2;
//   trace("Send channel state is 2: " + readyState2);
//   // If channel ready, enable user's input
//   if (readyState2 == "open") {
//     dataChannelSend2.disabled = false;
//     dataChannelSend2.focus();
//     dataChannelSend2.placeholder = "";
//     sendButton.disabled = false;
//   } else {
//     dataChannelSend2.disabled = true;
//     sendButton.disabled = true;
//   }
// }

// function handleReceiveChannelStateChange2() {
//   var readyState2 = receiveChannel.readyState2;
//   trace("Receive channel state is 2: " + readyState2);
//   // If channel ready, enable user's input
//   if (readyState2 == "open") {
//     dataChannelSend2.disabled = false;
//     dataChannelSend2.focus();
//     dataChannelSend2.placeholder = "";
//     sendButton.disabled = false;
//   } else {
//     dataChannelSend2.disabled = true;
//     sendButton.disabled = true;
//   }
// }

// ICE candidates management
function handleIceCandidate2(event) {
  console.log("handleIceCandidate2 event: ", event);
  if (event.candidate) {
    sendMessage({
      type: "candidate 2",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates 2.");
  }
}

// Create Offer
function doCall2() {
  console.log("Creating Offer 2...");
  pc2.createOffer(setLocalAndSendMessage2, onSignalingError);
}

// // Signalling error handler
// function onSignalingError(error) {
//   console.log("Failed to create signaling message : " + error.name);
// }

// Create Answer
function doAnswer2() {
  console.log("Sending answer to peer 2.");
  pc2.createAnswer(setLocalAndSendMessage2, onSignalingError);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage2(sessionDescription) {
  pc2.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function handleRemoteStreamAdded2(event) {
  console.log("Remote stream added.");
  remoteVideo2.srcObject = event.stream;
  remoteStream2 = event.stream;
}

function handleRemoteStreamRemoved2(event) {
  console.log("Remote stream removed. Event: ", event);
}
/////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
// Clean-up functions...

function hangup() {
  console.log("Hanging up.");
  stop();
  sendMessage("bye");
}

function handleRemoteHangup() {
  console.log("Session terminated.");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (pc) pc.close();
  pc = null;
  // if (sendChannel2) sendChannel2.close();
  if (receiveChannel2) receiveChannel2.close();
  if (pc2) pc2.close();
  pc2 = null;
  sendButton.disabled = true;
}

///////////////////////////////////////////

