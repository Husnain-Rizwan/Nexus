import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import { CalendarDays, CheckCircle2, Clock, Info, Plus, Save, Send, Trash2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import {
  createAvailabilitySlot,
  createMeetingRequest,
  deleteAvailabilitySlot,
  getAvailabilitySlots,
  getConfirmedMeetingsForUser,
  getMeetingRequests,
  getMeetingRequestsForUser,
  getPendingMeetingRequestsForUser,
  updateAvailabilitySlot,
  updateMeetingRequestStatus
} from '../../data/meetings';
import { findUserById } from '../../data/users';
import { AvailabilitySlot, MeetingRequest } from '../../types';

type CalendarEventKind = 'availability' | 'meeting';

interface CalendarEventDetails {
  id: string;
  kind: CalendarEventKind;
  title: string;
  start: string;
  end: string;
  ownerId?: string;
  requesterId?: string;
  receiverId?: string;
  status?: MeetingRequest['status'];
  message?: string;
  directionLabel?: string;
}

const formatDateTime = (value: string): string => {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};

const toDateTimeInputValue = (value: string): string => {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const fromDateTimeInputValue = (value: string): string => {
  return new Date(value).toISOString();
};

const getMeetingTitle = (meeting: MeetingRequest, currentUserId: string): string => {
  const otherUserId = meeting.requesterId === currentUserId ? meeting.receiverId : meeting.requesterId;
  const otherUser = findUserById(otherUserId);
  return `Meeting with ${otherUser?.name || 'User'}`;
};

const getMeetingDirectionLabel = (meeting: MeetingRequest, currentUserId: string): string => {
  if (meeting.requesterId === currentUserId) {
    const receiver = findUserById(meeting.receiverId);
    return `You requested ${receiver?.name || 'User'}`;
  }

  const requester = findUserById(meeting.requesterId);
  return `Requested by ${requester?.name || 'User'}`;
};

const getAvailabilityTitle = (slot: AvailabilitySlot): string => {
  const owner = findUserById(slot.userId);
  return slot.title || `${owner?.name || 'User'} available`;
};

const getStatusBadgeVariant = (status: MeetingRequest['status']) => {
  if (status === 'accepted') return 'success';
  if (status === 'declined') return 'gray';
  return 'warning';
};

const getRequestSenderName = (request: MeetingRequest): string => {
  return findUserById(request.requesterId)?.name || 'User';
};

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [allMeetingRequests, setAllMeetingRequests] = useState<MeetingRequest[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetails | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [availabilityTitle, setAvailabilityTitle] = useState('');
  const [editAvailabilityTitle, setEditAvailabilityTitle] = useState('');
  const [editAvailabilityStart, setEditAvailabilityStart] = useState('');
  const [editAvailabilityEnd, setEditAvailabilityEnd] = useState('');
  const [meetingMessage, setMeetingMessage] = useState('');

  const refreshCalendarData = () => {
    if (!user) return;
    setAvailabilitySlots(getAvailabilitySlots());
    setAllMeetingRequests(getMeetingRequests());
    setMeetingRequests(getMeetingRequestsForUser(user.id));
  };

  useEffect(() => {
    refreshCalendarData();
  }, [user]);

  const confirmedMeetings = useMemo(
    () => (user ? getConfirmedMeetingsForUser(user.id) : []),
    [meetingRequests, user]
  );
  const pendingRequests = useMemo(
    () => (user ? getPendingMeetingRequestsForUser(user.id) : []),
    [meetingRequests, user]
  );
  const bookedAvailabilitySlotIds = useMemo(() => {
    return new Set(
      allMeetingRequests
        .filter(request => request.status === 'accepted' && request.availabilitySlotId)
        .map(request => request.availabilitySlotId as string)
    );
  }, [allMeetingRequests]);
  const visibleAvailabilitySlots = useMemo(() => {
    return availabilitySlots.filter(slot => !bookedAvailabilitySlotIds.has(slot.id));
  }, [availabilitySlots, bookedAvailabilitySlotIds]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    if (!user) return [];

    const availabilityEvents: EventInput[] = visibleAvailabilitySlots.map(slot => ({
      id: slot.id,
      title: getAvailabilityTitle(slot),
      start: slot.start,
      end: slot.end,
      backgroundColor: slot.userId === user.id ? '#EA580C' : '#F97316',
      borderColor: slot.userId === user.id ? '#EA580C' : '#FB923C',
      textColor: '#FFFFFF',
      extendedProps: {
        kind: 'availability',
        ownerId: slot.userId
      }
    }));

    const meetingEvents: EventInput[] = meetingRequests.map(meeting => {
      const isAccepted = meeting.status === 'accepted';
      const isDeclined = meeting.status === 'declined';

      return {
        id: meeting.id,
        title: getMeetingTitle(meeting, user.id),
        start: meeting.start,
        end: meeting.end,
        backgroundColor: isAccepted ? '#16A34A' : isDeclined ? '#6B7280' : '#D97706',
        borderColor: isAccepted ? '#15803D' : isDeclined ? '#4B5563' : '#B45309',
        textColor: '#FFFFFF',
        extendedProps: {
          kind: 'meeting',
          requesterId: meeting.requesterId,
          receiverId: meeting.receiverId,
          status: meeting.status,
          message: meeting.message,
          directionLabel: getMeetingDirectionLabel(meeting, user.id)
        }
      };
    });

    return [...availabilityEvents, ...meetingEvents];
  }, [meetingRequests, user, visibleAvailabilitySlots]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    const props = event.extendedProps as Partial<CalendarEventDetails>;
    const nextEvent = {
      id: event.id,
      kind: props.kind || 'availability',
      title: event.title,
      start: event.start?.toISOString() || '',
      end: event.end?.toISOString() || event.start?.toISOString() || '',
      ownerId: props.ownerId,
      requesterId: props.requesterId,
      receiverId: props.receiverId,
      status: props.status,
      message: props.message,
      directionLabel: props.directionLabel
    };

    setSelectedRange(null);
    setSelectedEvent(nextEvent);
    setMeetingMessage('');

    if (nextEvent.kind === 'availability') {
      setEditAvailabilityTitle(nextEvent.title);
      setEditAvailabilityStart(toDateTimeInputValue(nextEvent.start));
      setEditAvailabilityEnd(toDateTimeInputValue(nextEvent.end));
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const nextRange = {
      start: selectInfo.start.toISOString(),
      end: selectInfo.end.toISOString()
    };

    setSelectedEvent(null);
    setSelectedRange(nextRange);
    setAvailabilityTitle('');
    setEditAvailabilityTitle('');
    setEditAvailabilityStart(toDateTimeInputValue(nextRange.start));
    setEditAvailabilityEnd(toDateTimeInputValue(nextRange.end));
    selectInfo.view.calendar.unselect();
  };

  const handleCreateAvailability = () => {
    if (!user || !selectedRange) return;

    createAvailabilitySlot({
      userId: user.id,
      title: availabilityTitle.trim() || 'Available',
      start: selectedRange.start,
      end: selectedRange.end
    });

    toast.success('Availability slot added');
    setSelectedRange(null);
    setAvailabilityTitle('');
    refreshCalendarData();
  };

  const handleUpdateAvailability = () => {
    if (!selectedEvent) return;

    const start = fromDateTimeInputValue(editAvailabilityStart);
    const end = fromDateTimeInputValue(editAvailabilityEnd);

    if (new Date(end).getTime() <= new Date(start).getTime()) {
      toast.error('End time must be after start time');
      return;
    }

    const updatedSlot = updateAvailabilitySlot(selectedEvent.id, {
      title: editAvailabilityTitle.trim() || 'Available',
      start,
      end
    });

    if (!updatedSlot) {
      toast.error('Availability slot not found');
      return;
    }

    toast.success('Availability slot updated');
    setSelectedEvent({
      ...selectedEvent,
      title: updatedSlot.title || 'Available',
      start: updatedSlot.start,
      end: updatedSlot.end
    });
    refreshCalendarData();
  };

  const handleDeleteAvailability = () => {
    if (!selectedEvent) return;

    const wasDeleted = deleteAvailabilitySlot(selectedEvent.id);
    if (!wasDeleted) {
      toast.error('Availability slot not found');
      return;
    }

    toast.success('Availability slot deleted');
    setSelectedEvent(null);
    refreshCalendarData();
  };

  const handleCreateMeetingRequest = () => {
    if (!user || !selectedEvent?.ownerId || selectedEvent.ownerId === user.id) return;

    const existingRequest = meetingRequests.find(request => (
      request.availabilitySlotId === selectedEvent.id &&
      request.requesterId === user.id &&
      request.status !== 'declined'
    ));

    if (existingRequest) {
      toast.error(existingRequest.status === 'accepted' ? 'This meeting is already confirmed' : 'You already sent a request for this slot');
      return;
    }

    if (bookedAvailabilitySlotIds.has(selectedEvent.id)) {
      toast.error('This slot has already been booked');
      setSelectedEvent(null);
      refreshCalendarData();
      return;
    }

    createMeetingRequest({
      requesterId: user.id,
      receiverId: selectedEvent.ownerId,
      availabilitySlotId: selectedEvent.id,
      start: selectedEvent.start,
      end: selectedEvent.end,
      message: meetingMessage.trim() || undefined
    });

    toast.success('Meeting request sent');
    setMeetingMessage('');
    refreshCalendarData();
  };

  const handleMeetingStatusUpdate = (requestId: string, status: MeetingRequest['status']) => {
    const updatedRequest = updateMeetingRequestStatus(requestId, status);

    if (!updatedRequest) {
      toast.error('Meeting request not found');
      return;
    }

    toast.success(status === 'accepted' ? 'Meeting request accepted' : 'Meeting request declined');
    if (selectedEvent?.id === requestId) {
      setSelectedEvent({
        ...selectedEvent,
        status: updatedRequest.status
      });
    }
    refreshCalendarData();
  };

  if (!user) return null;

  const selectedAvailabilityIsOwnedByUser =
    selectedEvent?.kind === 'availability' && selectedEvent.ownerId === user.id;
  const selectedAvailabilityCanBeRequested =
    selectedEvent?.kind === 'availability' && selectedEvent.ownerId && selectedEvent.ownerId !== user.id;
  const selectedAvailabilityRequest = selectedEvent?.kind === 'availability'
    ? meetingRequests.find(request => (
      request.availabilitySlotId === selectedEvent.id &&
      request.requesterId === user.id &&
      request.status !== 'declined'
    ))
    : undefined;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Calendar</h1>
          <p className="text-gray-600">Manage availability, requests, and confirmed meetings.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-md px-4 py-3">
            <p className="text-xs font-medium text-gray-500">Available Slots</p>
            <p className="text-xl font-semibold text-primary-700">{visibleAvailabilitySlots.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-4 py-3">
            <p className="text-xs font-medium text-gray-500">Pending</p>
            <p className="text-xl font-semibold text-warning-700">{pendingRequests.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-gray-500">Confirmed</p>
            <p className="text-xl font-semibold text-success-700">{confirmedMeetings.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Card className="xl:col-span-3">
          <CardBody className="calendar-shell">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={calendarEvents}
              selectable
              selectMirror
              nowIndicator
              eventClick={handleEventClick}
              select={handleDateSelect}
              height="auto"
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              allDaySlot={false}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Details</h2>
              <Info size={18} className="text-gray-400" />
            </CardHeader>
            <CardBody>
              {selectedEvent ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedEvent.title}</p>
                    {selectedEvent.status && (
                      <Badge variant={getStatusBadgeVariant(selectedEvent.status)} className="mt-2 capitalize">
                        {selectedEvent.status}
                      </Badge>
                    )}
                    {selectedEvent.directionLabel && (
                      <p className="mt-2 text-xs font-medium text-gray-500">
                        {selectedEvent.directionLabel}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-start">
                      <CalendarDays size={16} className="mr-2 mt-0.5 text-primary-600" />
                      <span>{formatDateTime(selectedEvent.start)}</span>
                    </div>
                    <div className="flex items-start">
                      <Clock size={16} className="mr-2 mt-0.5 text-primary-600" />
                      <span>{formatDateTime(selectedEvent.end)}</span>
                    </div>
                  </div>

                  {selectedEvent.message && (
                    <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                      {selectedEvent.message}
                    </p>
                  )}

                  {selectedAvailabilityIsOwnedByUser && (
                    <div className="space-y-3 border-t border-gray-200 pt-4">
                      <Input
                        label="Availability title"
                        value={editAvailabilityTitle}
                        onChange={(event) => setEditAvailabilityTitle(event.target.value)}
                        fullWidth
                      />
                      <Input
                        label="Start"
                        type="datetime-local"
                        value={editAvailabilityStart}
                        onChange={(event) => setEditAvailabilityStart(event.target.value)}
                        fullWidth
                      />
                      <Input
                        label="End"
                        type="datetime-local"
                        value={editAvailabilityEnd}
                        onChange={(event) => setEditAvailabilityEnd(event.target.value)}
                        fullWidth
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          leftIcon={<Save size={16} />}
                          onClick={handleUpdateAvailability}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="error"
                          leftIcon={<Trash2 size={16} />}
                          onClick={handleDeleteAvailability}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedAvailabilityCanBeRequested && (
                    <div className="space-y-3 border-t border-gray-200 pt-4">
                      {selectedAvailabilityRequest ? (
                        <div className="rounded-md bg-warning-50 p-3">
                          <p className="text-sm font-medium text-warning-700">
                            {selectedAvailabilityRequest.status === 'accepted'
                              ? 'This meeting is already confirmed.'
                              : 'You already requested this slot.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <label className="block text-sm font-medium text-gray-700">
                            Request message
                          </label>
                          <textarea
                            value={meetingMessage}
                            onChange={(event) => setMeetingMessage(event.target.value)}
                            rows={4}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                            placeholder="Share what you would like to discuss..."
                          />
                          <Button
                            type="button"
                            fullWidth
                            leftIcon={<Send size={16} />}
                            onClick={handleCreateMeetingRequest}
                          >
                            Send Meeting Request
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : selectedRange ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">New availability slot</p>
                    <p className="mt-2 text-sm text-gray-600">{formatDateTime(selectedRange.start)}</p>
                    <p className="text-sm text-gray-600">{formatDateTime(selectedRange.end)}</p>
                  </div>
                  <Input
                    label="Title"
                    value={availabilityTitle}
                    onChange={(event) => setAvailabilityTitle(event.target.value)}
                    placeholder="Available for meetings"
                    fullWidth
                  />
                  <Button
                    type="button"
                    fullWidth
                    leftIcon={<Plus size={16} />}
                    onClick={handleCreateAvailability}
                  >
                    Add Availability
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarDays size={32} className="mx-auto text-gray-400" />
                  <p className="mt-3 text-sm text-gray-600">Select a time range or calendar event.</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Meeting Requests</h2>
              <Badge variant="warning">{pendingRequests.length} pending</Badge>
            </CardHeader>
            <CardBody>
              {pendingRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Requested by {getRequestSenderName(request)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDateTime(request.start)}
                          </p>
                        </div>
                        <Badge variant="warning" size="sm">Pending</Badge>
                      </div>

                      {request.message && (
                        <p className="mt-3 rounded-md bg-gray-50 p-2 text-sm text-gray-600">
                          {request.message}
                        </p>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="success"
                          leftIcon={<CheckCircle2 size={15} />}
                          onClick={() => handleMeetingStatusUpdate(request.id, 'accepted')}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          leftIcon={<XCircle size={15} />}
                          onClick={() => handleMeetingStatusUpdate(request.id, 'declined')}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Clock size={28} className="mx-auto text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">No pending meeting requests.</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Legend</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="h-3 w-3 rounded-full bg-primary-600 mr-3"></span>
                Your availability
              </div>
              <div className="flex items-center text-gray-700">
                <span className="h-3 w-3 rounded-full bg-primary-400 mr-3"></span>
                Other availability
              </div>
              <div className="flex items-center text-gray-700">
                <CheckCircle2 size={16} className="mr-2 text-success-700" />
                Confirmed meeting
              </div>
              <div className="flex items-center text-gray-700">
                <Clock size={16} className="mr-2 text-warning-700" />
                Pending request
              </div>
              <div className="flex items-center text-gray-700">
                <XCircle size={16} className="mr-2 text-gray-500" />
                Declined request
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
