export type MissionType = 'SETUP' | 'BUILD' | 'AI_CORE' | 'LEARN' | 'SHIP_IT' | 'OPTIMIZE' | 'CAPSTONE';

export interface CandidateMission {
  day: number;
  title: string;
  passed?: boolean;
  skipped?: boolean;
  attempts?: number;
}

export interface CandidateSignals {
  commitDays: number;
  missionsCompleted: number;
  missionsFirstTry: number;
}

export interface Candidate {
  id: string;
  name: string;
  jobRole: string;
  yearsExperience: number;
  education: string;
  status: string;
  missions: CandidateMission[];
  signals: CandidateSignals;
}

export interface CurriculumDay {
  day: number;
  module: number;
  moduleTitle: string;
  title: string;
  type: MissionType;
  tools: string[];
  objectives: string[];
  mechanism: string;
  purpose: string;
  commonFailureModes: string[];
  adjacentConcepts: string[];
  ahaMoment: string;
}

export interface ChatMessage {
  id: string;
  sender: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
  topicDay?: number;
  topicTitle?: string;
  actionTaken?: 'escalate' | 'perturb' | 'probe' | 'pivot';
}

export interface FeedbackData {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
}

export interface SkillScore {
  topic: string;
  day: number;
  depthScore: number;
}

export interface InterviewAPIResponse {
  reply?: string;
  done?: boolean;
  feedback?: FeedbackData;
  skillChart?: SkillScore[];
  terminated?: boolean;
  terminationReason?: string;
  buildVersion?: string;
  error?: string;
}

export interface StartInterviewRequest {
  sessionId: string;
  candidate: Candidate;
}

export interface TurnInterviewRequest {
  sessionId: string;
  candidate: Candidate;
  message?: string;
  action?: 'terminate_violation';
  history?: Array<{ sender: ChatMessage['sender']; text: string; timestamp?: string }>;
}
