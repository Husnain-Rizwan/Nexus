import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  ScreenShareOff,
  UserRound,
  Video,
  VideoOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../context/AuthContext';

export const VideoCallPage: React.FC = () => {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(track => track.stop());
  };

  const attachLocalStream = (stream: MediaStream | null) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
    }
  };

  const attachScreenStream = (stream: MediaStream | null) => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = stream;
    }
  };

  const stopScreenShare = () => {
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    attachScreenStream(null);
    setIsScreenSharing(false);
  };

  const endCall = () => {
    stopScreenShare();
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    attachLocalStream(null);
    setIsCallActive(false);
    setIsMicOn(true);
    setIsCameraOn(true);
    setPermissionError(null);
  };

  useEffect(() => {
    return () => {
      stopScreenShare();
      stopStream(localStreamRef.current);
    };
  }, []);

  useEffect(() => {
    attachLocalStream(localStreamRef.current);
    attachScreenStream(screenStreamRef.current);
  }, [isCallActive, isScreenSharing]);

  const startCall = async () => {
    setPermissionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      attachLocalStream(stream);
      setIsCallActive(true);
      setIsMicOn(true);
      setIsCameraOn(true);
      toast.success('Call started');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Camera or microphone access was denied';
      setPermissionError(message);
      toast.error('Unable to start call');
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMicState = !isMicOn;
    stream.getAudioTracks().forEach(track => {
      track.enabled = nextMicState;
    });
    setIsMicOn(nextMicState);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextCameraState = !isCameraOn;
    stream.getVideoTracks().forEach(track => {
      track.enabled = nextCameraState;
    });
    setIsCameraOn(nextCameraState);
  };

  const startScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      const [screenTrack] = stream.getVideoTracks();
      screenTrack.addEventListener('ended', () => {
        stopScreenShare();
      });

      screenStreamRef.current = stream;
      attachScreenStream(stream);
      setIsScreenSharing(true);
      toast.success('Screen sharing started');
    } catch {
      toast.error('Screen sharing was cancelled');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Call</h1>
          <p className="text-gray-600">Start a mock WebRTC meeting with camera, audio, and screen sharing.</p>
        </div>

        <Badge variant={isCallActive ? 'success' : 'gray'} className="self-start sm:self-auto">
          {isCallActive ? 'In call' : 'Ready'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <Card>
            <CardBody className="p-0">
              <div className="relative aspect-video bg-gray-950">
                {isScreenSharing ? (
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-contain bg-gray-950"
                  />
                ) : isCallActive ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full bg-gray-950 ${isCameraOn ? 'object-cover' : 'hidden'}`}
                  />
                ) : null}

                {(!isCallActive || (!isScreenSharing && !isCameraOn)) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center">
                      <UserRound size={36} />
                    </div>
                    <p className="mt-4 text-lg font-semibold">
                      {isCallActive ? 'Camera is off' : 'Ready to start call'}
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      {isCallActive ? 'Your audio controls are still active.' : 'Camera preview appears after starting.'}
                    </p>
                  </div>
                )}

                {isCallActive && isScreenSharing && (
                  <div className="absolute bottom-4 right-4 w-40 overflow-hidden rounded-md border border-white/20 bg-gray-900">
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`aspect-video w-full ${isCameraOn ? 'object-cover' : 'hidden'}`}
                    />
                    {!isCameraOn && (
                      <div className="aspect-video flex items-center justify-center text-white">
                        <VideoOff size={20} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {permissionError && (
            <div className="rounded-md border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-700">
              {permissionError}
            </div>
          )}

          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {!isCallActive ? (
                  <Button
                    type="button"
                    size="lg"
                    leftIcon={<Phone size={18} />}
                    onClick={startCall}
                  >
                    Start Call
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant={isMicOn ? 'outline' : 'warning'}
                      leftIcon={isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
                      onClick={toggleMic}
                    >
                      {isMicOn ? 'Mute' : 'Unmute'}
                    </Button>
                    <Button
                      type="button"
                      variant={isCameraOn ? 'outline' : 'warning'}
                      leftIcon={isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                      onClick={toggleCamera}
                    >
                      {isCameraOn ? 'Camera Off' : 'Camera On'}
                    </Button>
                    <Button
                      type="button"
                      variant={isScreenSharing ? 'warning' : 'outline'}
                      leftIcon={isScreenSharing ? <ScreenShareOff size={18} /> : <MonitorUp size={18} />}
                      onClick={startScreenShare}
                    >
                      {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                    </Button>
                    <Button
                      type="button"
                      variant="error"
                      leftIcon={<PhoneOff size={18} />}
                      onClick={endCall}
                    >
                      End Call
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Participants</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center">
                <Avatar src={user.avatarUrl} alt={user.name} size="md" status={isCallActive ? 'online' : 'offline'} />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">You</p>
                </div>
              </div>

              <div className="rounded-md border border-dashed border-gray-300 p-4 text-center">
                <UserRound size={24} className="mx-auto text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700">Remote participant</p>
                <p className="mt-1 text-xs text-gray-500">Frontend mock placeholder</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Call Status</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Microphone</span>
                <Badge variant={isMicOn ? 'success' : 'warning'}>{isMicOn ? 'On' : 'Muted'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Camera</span>
                <Badge variant={isCameraOn ? 'success' : 'warning'}>{isCameraOn ? 'On' : 'Off'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Screen share</span>
                <Badge variant={isScreenSharing ? 'success' : 'gray'}>{isScreenSharing ? 'Active' : 'Off'}</Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
