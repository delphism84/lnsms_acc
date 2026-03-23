/** 호출벨 메이커/모델 (에이전트 .NET 기본 필백과 동일) */
export interface CallBellModel {
  id: string;
  name: string;
}

export interface CallBellMaker {
  id: string;
  name: string;
  models: CallBellModel[];
}

export const DEFAULT_CALLBELL_MAKERS: CallBellMaker[] = [
  {
    id: '4478625',
    name: '447,8625',
    models: [
      { id: '4478625_fm_direct', name: 'FM 다이렉트' },
      { id: '4478625_fm_packet', name: 'FM 패킷' },
      { id: '4478625_am', name: 'AM' },
    ],
  },
  {
    id: 'necall',
    name: 'NE CALL',
    models: [
      { id: 'ne100', name: 'NE-100' },
      { id: 'ne200', name: 'NE-200' },
      { id: 'ne700', name: 'NE-700' },
    ],
  },
  {
    id: 'syscall',
    name: '씨스콜',
    models: [{ id: 'syscall_default', name: '(기본)' }],
  },
  {
    id: 'linkman',
    name: '링크멘',
    models: [{ id: 'linkman_default', name: '(기본)' }],
  },
  {
    id: 'easycall',
    name: '이지콜',
    models: [{ id: 'easycall_default', name: '(기본)' }],
  },
];
