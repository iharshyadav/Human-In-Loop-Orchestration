import express, { Request, Response } from 'express';
import { serve } from "inngest/express";
import { functions } from './inngest';
import { inngest } from './inngest/client';
import approvalRouter from './routes/approval';
import usersRouter from './routes/users';
import workflowRouter from './routes/workflow';
import cors from "cors"

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin : ["http://localhost:3000"]
}))

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/approval', approvalRouter);
app.use('/api/users', usersRouter);
app.use('/api/workflow', workflowRouter);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, harsh!');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;