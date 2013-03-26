require([
  'modules/peer', 'modules/transport', 'modules/layout', 'backbone', 'q'
  ], function(Peer, Transport, Layout, Backbone, Q) {
  'use strict';

  var config = {
    socketServer: 'ws://' + window.location.host
  };
  var user = new Peer.Model();
  // activePeer
  // A global reference to the current call.
  // TODO: Re-factor in order to support multiple simultaneous connections (and
  // remove this variable)
  var activePeer;

  var mediaConstraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };

  function createOfferFailed() {
    console.error('Create Answer failed');
  }

  function createAnswerFailed() {
    console.error('Create Answer failed');
  }
  var transport = new Transport({
    invite: function(request) {
      var blob = request && request.username && request.username.blob;
      var locationID = request && request.username && request.username.from;
      var remoteSession = blob && blob.session;

      if (!blob) {
        console.error('No blob found. Ignoring invite.');
        return;
      } else if (!locationID) {
        console.error('Location ID not found. Ignoring invite.');
        return;
      } else if (!remoteSession) {
        console.error('Remote session not specified. Ignoring invite.');
        return;
      }

      // TODO: Prompt user to accept/reject call (instead of blindly accepting)
      // and move following logic into "Accept" handler.
      console.log('Receiving call from ' + blob.userName +
        '. Would you like to answer?');

      activePeer = new Peer.Model({
        name: blob.userName,
        locationID: locationID
      });
      activePeer.transport = transport;

      return layout.startCall(activePeer).then(function(stream) {
        var dfd = Q.defer();

        activePeer.addStream(stream);

        console.log('Creating remote session description:', remoteSession);
        activePeer.setRemoteDescription(remoteSession);
        console.log('Sending answer...');
        activePeer.createAnswer(function(sessionDescription) {
            this.setLocalDescription(sessionDescription);
            dfd.resolve({
              peer: true,
              sessionDescription: sessionDescription
            });
          },
          createAnswerFailed, mediaConstraints);

        return dfd.promise;
      });
    },
    bye: function() {
      activePeer.destroy();
    },
    update: function(msg) {
      if (!activePeer.isActive()) {
        return;
      }
      console.log('Received ICE candidate:', msg.candidate);
      activePeer.addIceCandidate(msg.candidate);
    }
  });
  // TODO: Fetch contacts from remote identitiy provider
  var contacts = new Peer.Collection([
    { name: 'creationix' },
    { name: 'robin' },
    { name: 'erik' },
    { name: 'lawrence' },
    { name: 'cassie' },
    { name: 'jugglinmike' }
  ], { transport: transport });
  var layout = new Layout({
    el: '#app',
    user: user,
    contacts: contacts
  });
  layout.render();
  contacts.on('send-connect-request', function(peer) {
    if (transport.state === 'OPEN') {

      // TODO: Remove this line and reduce dependence on global state.
      activePeer = peer;

      layout.startCall(peer)
        .then(function() {
          peer.createOffer(
            function(sessionDescription) {
              this.setLocalDescription(sessionDescription);
              transport.peerLocationFind(peer.get('name'), {
                session: sessionDescription,
                userName: user.get('name')
              }).then(function(findReply) {
                peer.setRemoteDescription(findReply.sessionDescription);
                peer.set('locationID', findReply.from);
              }, function() {
                // TODO: Update the UI to reflect this failure.
                console.error('Find request failed.');
              });
            },
            createOfferFailed,
            mediaConstraints);
        }, function() { console.error(arguments); });
    }
  });
  layout.on('hangup', function() {
    transport.request('bye', {
      to: activePeer.get('locationID')
    });
    activePeer.destroy();
  });

  user.on('change:name', function() {
    transport.open(new WebSocket(config.socketServer))
      .then(function() {
        return transport.sessionCreate(user.get('name'));
      })
      .then(function() {
        // Simulate network latency
        setTimeout(function() {
          layout.login();
        }, 800);
      }, console.error.bind(console));
  });

});
