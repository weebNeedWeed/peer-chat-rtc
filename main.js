let APP_ID = "a5b741fbf5a64c588e65c18bb7e91c07";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

let urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get("room");

if (!roomId) {
	window.location = "lobby.html";
}

let servers = {
	iceServers: [
		{
			urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
		}
	]
};

let constraints = {
	video: {
		width: { min: 640, ideal: 1920, max: 1920 },
		height: { min: 480, ideal: 1080, max: 1080 },
	},
	audio: true
}

let init = async () => {
	localStream = await navigator.mediaDevices.getUserMedia(constraints)
	document.getElementById("user-1").srcObject = localStream;

	client = AgoraRTM.createInstance(APP_ID);
	await client.login({ uid, token });

	channel = client.createChannel("room" + roomId);
	await channel.join();

	channel.on("MemberJoined", handleMemberJoined);
	channel.on("MemberLeft", handleMemberLeft);

	client.on("MessageFromPeer", handleMessageFromPeer);
};

let handleMessageFromPeer = async (message, memberId) => {
	message = JSON.parse(message.text);

	if (message.type === "offer") {
		await createAnswer(memberId, message.offer);
	}

	if (message.type === "answer") {
		await addAnswer(message.answer);
	}

	if (message.type === "candidate") {
		await peerConnection.addIceCandidate(message.candidate);
	}
};

let handleMemberJoined = async (memberId) => {
	console.log("A new member joined the channel", memberId);
	await createOffer(memberId);
};

let handleMemberLeft = () => {
	document.getElementById("user-2").style.display = "none";
	document.getElementById('user-1').classList.add('smallFrame')
};

let createPeerConnection = async (memberId) => {
	peerConnection = new RTCPeerConnection(servers);

	remoteStream = new MediaStream();
	document.getElementById("user-2").srcObject = remoteStream;
	document.getElementById("user-2").style.display = "block";

	document.getElementById('user-1').classList.add('smallFrame')

	localStream.getTracks().forEach(track => {
		peerConnection.addTrack(track, localStream);
	});

	peerConnection.ontrack = (event) => {
		event.streams[0].getTracks().forEach(track => {
			remoteStream.addTrack(track);
		});
	};

	peerConnection.onicecandidate = (event) => {
		if (event.candidate)
			client.sendMessageToPeer({ text: JSON.stringify({ type: "candidate", candidate: event.candidate }) }, memberId)
	};
};

let createAnswer = async (memberId, offer) => {
	await createPeerConnection(memberId);

	await peerConnection.setRemoteDescription(offer);

	let answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);

	client.sendMessageToPeer({ text: JSON.stringify({ type: "answer", answer }) }, memberId);
};

let createOffer = async (memberId) => {
	await createPeerConnection(memberId);

	let offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	client.sendMessageToPeer({ text: JSON.stringify({ type: "offer", offer }) }, memberId);
};

let addAnswer = async (answer) => {
	if (!peerConnection.currentRemoteDescription) {
		await peerConnection.setRemoteDescription(answer);
	}
};

let leaveChannel = async () => {
	await channel.leave();
	await client.logout();
};

let toggleCamera = () => {
	let videoTrack = localStream.getTracks().find(track => track.kind === "video");
	if (videoTrack.enabled) {
		videoTrack.enabled = false
		document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
	} else {
		videoTrack.enabled = true
		document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
	}
};

let toggleMic = () => {
	let audioTrack = localStream.getTracks().find(track => track.kind === "audio");
	if (audioTrack.enabled) {
		audioTrack.enabled = false
		document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
	} else {
		audioTrack.enabled = true
		document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
	}
};

// Trigger the leaveChannel right after users close their browser
// Because Agora only auto trigger it after 30s
window.addEventListener("beforeunload", leaveChannel);
document.getElementById("camera-btn").onclick = toggleCamera;
document.getElementById("mic-btn").onclick = toggleMic;

init();
