import { AvailabilitySlot, MeetingRequest, MeetingRequestStatus } from '../types';

const AVAILABILITY_STORAGE_KEY = 'business_nexus_availability_slots';
const MEETING_REQUEST_STORAGE_KEY = 'business_nexus_meeting_requests';

type CreateAvailabilitySlotInput = Omit<AvailabilitySlot, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateAvailabilitySlotInput = Partial<Pick<AvailabilitySlot, 'start' | 'end' | 'title'>>;
type CreateMeetingRequestInput = Omit<MeetingRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

const canUseLocalStorage = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

const addDays = (date: Date, days: number): Date => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const atHour = (date: Date, hour: number): string => {
  const nextDate = new Date(date);
  nextDate.setHours(hour, 0, 0, 0);
  return nextDate.toISOString();
};

const createInitialAvailabilitySlots = (): AvailabilitySlot[] => {
  const today = new Date();

  return [
    {
      id: 'slot1',
      userId: 'i1',
      title: 'Available for founder calls',
      start: atHour(addDays(today, 1), 10),
      end: atHour(addDays(today, 1), 11),
      createdAt: new Date().toISOString()
    },
    {
      id: 'slot2',
      userId: 'i2',
      title: 'Open office hours',
      start: atHour(addDays(today, 2), 14),
      end: atHour(addDays(today, 2), 15),
      createdAt: new Date().toISOString()
    },
    {
      id: 'slot3',
      userId: 'e1',
      title: 'Startup intro availability',
      start: atHour(addDays(today, 3), 13),
      end: atHour(addDays(today, 3), 14),
      createdAt: new Date().toISOString()
    }
  ];
};

const createInitialMeetingRequests = (): MeetingRequest[] => {
  const today = new Date();

  return [
    {
      id: 'meet1',
      requesterId: 'i1',
      receiverId: 'e1',
      availabilitySlotId: 'slot3',
      start: atHour(addDays(today, 3), 13),
      end: atHour(addDays(today, 3), 14),
      message: 'I would like to learn more about TechWave AI and your current traction.',
      status: 'accepted',
      createdAt: new Date().toISOString()
    },
    {
      id: 'meet2',
      requesterId: 'e2',
      receiverId: 'i2',
      availabilitySlotId: 'slot2',
      start: atHour(addDays(today, 2), 14),
      end: atHour(addDays(today, 2), 15),
      message: 'Could we discuss sustainable packaging and impact investing fit?',
      status: 'pending',
      createdAt: new Date().toISOString()
    }
  ];
};

const readStorage = <T>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) return fallback;

  const storedValue = localStorage.getItem(key);
  if (!storedValue) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const writeStorage = <T>(key: string, value: T): void => {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
};

const sortByStartDate = <T extends { start: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
};

const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getAvailabilitySlots = (): AvailabilitySlot[] => {
  return sortByStartDate(readStorage(AVAILABILITY_STORAGE_KEY, createInitialAvailabilitySlots()));
};

export const getAvailabilitySlotsForUser = (userId: string): AvailabilitySlot[] => {
  return getAvailabilitySlots().filter(slot => slot.userId === userId);
};

export const createAvailabilitySlot = (slotInput: CreateAvailabilitySlotInput): AvailabilitySlot => {
  const slots = getAvailabilitySlots();
  const newSlot: AvailabilitySlot = {
    ...slotInput,
    id: createId('slot'),
    createdAt: new Date().toISOString()
  };

  writeStorage(AVAILABILITY_STORAGE_KEY, [...slots, newSlot]);
  return newSlot;
};

export const updateAvailabilitySlot = (
  slotId: string,
  updates: UpdateAvailabilitySlotInput
): AvailabilitySlot | null => {
  const slots = getAvailabilitySlots();
  const slotIndex = slots.findIndex(slot => slot.id === slotId);
  if (slotIndex === -1) return null;

  const updatedSlot: AvailabilitySlot = {
    ...slots[slotIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  slots[slotIndex] = updatedSlot;
  writeStorage(AVAILABILITY_STORAGE_KEY, slots);
  return updatedSlot;
};

export const deleteAvailabilitySlot = (slotId: string): boolean => {
  const slots = getAvailabilitySlots();
  const nextSlots = slots.filter(slot => slot.id !== slotId);

  if (nextSlots.length === slots.length) return false;

  writeStorage(AVAILABILITY_STORAGE_KEY, nextSlots);
  return true;
};

export const getMeetingRequests = (): MeetingRequest[] => {
  return sortByStartDate(readStorage(MEETING_REQUEST_STORAGE_KEY, createInitialMeetingRequests()));
};

export const getMeetingRequestsForUser = (userId: string): MeetingRequest[] => {
  return getMeetingRequests().filter(
    request => request.requesterId === userId || request.receiverId === userId
  );
};

export const getPendingMeetingRequestsForUser = (userId: string): MeetingRequest[] => {
  return getMeetingRequests()
    .filter(request => request.receiverId === userId && request.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getConfirmedMeetingsForUser = (userId: string): MeetingRequest[] => {
  const now = Date.now();

  return getMeetingRequests().filter(request => {
    const userIsParticipant = request.requesterId === userId || request.receiverId === userId;
    return userIsParticipant && request.status === 'accepted' && new Date(request.end).getTime() >= now;
  });
};

export const createMeetingRequest = (requestInput: CreateMeetingRequestInput): MeetingRequest => {
  const requests = getMeetingRequests();
  const newRequest: MeetingRequest = {
    ...requestInput,
    id: createId('meet'),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  writeStorage(MEETING_REQUEST_STORAGE_KEY, [...requests, newRequest]);
  return newRequest;
};

export const updateMeetingRequestStatus = (
  requestId: string,
  status: MeetingRequestStatus
): MeetingRequest | null => {
  const requests = getMeetingRequests();
  const requestIndex = requests.findIndex(request => request.id === requestId);
  if (requestIndex === -1) return null;

  const updatedRequest: MeetingRequest = {
    ...requests[requestIndex],
    status,
    updatedAt: new Date().toISOString()
  };

  requests[requestIndex] = updatedRequest;
  writeStorage(MEETING_REQUEST_STORAGE_KEY, requests);
  return updatedRequest;
};

export const deleteMeetingRequest = (requestId: string): boolean => {
  const requests = getMeetingRequests();
  const nextRequests = requests.filter(request => request.id !== requestId);

  if (nextRequests.length === requests.length) return false;

  writeStorage(MEETING_REQUEST_STORAGE_KEY, nextRequests);
  return true;
};

export const resetMeetingData = (): void => {
  writeStorage(AVAILABILITY_STORAGE_KEY, createInitialAvailabilitySlots());
  writeStorage(MEETING_REQUEST_STORAGE_KEY, createInitialMeetingRequests());
};
