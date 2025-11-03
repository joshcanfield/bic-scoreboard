import type { UpdateEventPayload } from '../transport/server';

export type Penalty = NonNullable<UpdateEventPayload['home']['penalties']>[number];
export type Goal = NonNullable<UpdateEventPayload['home']['goals']>[number];
