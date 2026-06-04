import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { courseRouter } from './routes/courses';
import { planRouter } from './routes/plans';
import { checkinRouter } from './routes/checkins';
import { wrongAnswerRouter } from './routes/wrongAnswers';
import { noteRouter } from './routes/notes';
import { aiRouter } from './routes/ai';
import { statsRouter } from './routes/stats';
import { calendarRouter } from './routes/calendar';
import { notificationRouter } from './routes/notifications';
import { adminRouter } from './routes/admin';
import { resourceRouter } from './routes/resources';
import { notificationPreferenceRouter } from './routes/notificationPreferences';
import { goalRouter } from './routes/goals';
import { reportRouter } from './routes/reports';
import { groupRouter } from './routes/groups';
import { startCronJobs } from './jobs/scheduler';

export const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/courses', courseRouter);
app.use('/api/plans', planRouter);
app.use('/api/checkins', checkinRouter);
app.use('/api/wrong-answers', wrongAnswerRouter);
app.use('/api/notes', noteRouter);
app.use('/api/ai', aiRouter);
app.use('/api/stats', statsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/notification-preferences', notificationPreferenceRouter);
app.use('/api/goals', goalRouter);
app.use('/api/reports', reportRouter);
app.use('/api/groups', groupRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCronJobs();
});

export default app;
