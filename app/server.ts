import express, { Request, Response } from 'express';
import { serve } from "inngest/express";
import { functions } from './inngest';
import { inngest } from './inngest/client';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/inngest", serve({ client: inngest, functions }));


app.get('/', (req: Request, res: Response) => {
    res.send('Hello, world!');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;