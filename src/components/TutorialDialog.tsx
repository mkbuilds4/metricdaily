import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

const TutorialDialog: React.FC = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open tutorial">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Welcome to Metric Daily!</DialogTitle>
          <DialogDescription>
            Here&apos;s a quick guide to help you get started with tracking your productivity.
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto pr-3 space-y-4 text-foreground">
          <section>
            <h3 className="font-semibold text-lg">1. Dashboard Overview (Home Page)</h3>
            <p>
              This is your main hub. Here you&apos;ll find:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Quick Update:</strong> Easily add completed documents and video sessions for today. Your UPH and progress will update in real-time.
              </li>
              <li>
                <strong>Log Non-Work Time:</strong> Quickly log breaks (15m, 30m) or short training sessions (5m). These will adjust your total work hours for the day, affecting UPH calculations.
              </li>
              <li>
                <strong>Weekly Average UPH:</strong> See your average Units Per Hour for the current or past weeks (Monday-Sunday), based on your active target. Use the arrows to navigate weeks.
              </li>
              <li>
                <strong>Today&apos;s Target Progress:</strong> A detailed card showing your progress towards your active UPH target for the current day. It includes:
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  <li>Current Units completed vs. Target Units required for the day so far.</li>
                  <li>Your Current UPH vs. the Goal UPH of your active target.</li>
                  <li>Schedule Status: Shows if you are ahead or behind schedule to meet your goal by the end of your shift, and by how much time.</li>
                  <li>Estimated Goal Hit Time: Predicts when you might hit your daily UPH goal based on your current pace and scheduled end time.</li>
                </ul>
              </li>
              <li>
                <strong>Today&apos;s Metrics:</strong> A summary of your performance against all defined UPH targets for the current day, providing a broader view of your productivity.
              </li>
               <li>
                <strong>Clear All Data:</strong> A button to reset all your application data (logs and targets). Use with caution!
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg">2. Log Input / Targets Page</h3>
            <p>
              This page is where you manage your daily logs and UPH targets.
            </p>
            <h4 className="font-medium text-md mt-2">Work Log Input Form:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Add/Update Log:</strong> Input or modify your work details for any day.
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  <li>Date, Start Time, End Time (in HH:mm format).</li>
                  <li>Break and Training Duration (in minutes).</li>
                  <li>Documents and Video Sessions Completed.</li>
                  <li>Optional Notes for the day.</li>
                </ul>
              </li>
              <li>
                <strong>Calculated Hours:</strong> The form automatically calculates your net work hours based on shift times and non-work durations.
              </li>
              <li>
                <strong>Target Association:</strong> Logs are automatically associated with your currently active UPH target when saved.
              </li>
            </ul>
            <h4 className="font-medium text-md mt-3">UPH Target Manager:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Define Targets:</strong> Create different UPH targets (e.g., &quot;Meeting,&quot; &quot;Minimum,&quot; &quot;Outstanding&quot;).
              </li>
              <li>
                <strong>Target UPH:</strong> Set the goal Units Per Hour for each target.
              </li>
              <li>
                <strong>Docs/Videos Per Unit:</strong> Specify how many documents or video sessions make up ONE unit for that specific target. This allows for flexible unit definitions (e.g., 5.25 docs per unit).
              </li>
              <li>
                <strong>Activate Target:</strong> Set one target as &quot;active.&quot; This active target is used for dashboard progress indicators and default calculations.
              </li>
              <li>
                <strong>Edit/Delete Targets:</strong> Manage your existing targets. You cannot delete an active target.
              </li>
              <li><strong>Sort Columns:</strong> Click on column headers (Name, Target UPH, etc.) to sort the list.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg">3. Previous Logs Page</h3>
            <p>
              Review your past performance.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Log Summary:</strong> Each previous day&apos;s log is displayed. Click on a log entry to expand and see detailed metrics.
              </li>
              <li>
                <strong>Detailed Metrics:</strong> When expanded, you&apos;ll see a breakdown of your performance against all your defined UPH targets for that specific day, including units completed, average UPH, and difference from goal.
              </li>
              <li>
                <strong>Delete Logs:</strong> Remove individual past log entries using the trash icon.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg">Understanding Units and UPH</h3>
            <p>
              Your productivity is measured in &quot;Units Per Hour&quot; (UPH).
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Units:</strong> A &quot;unit&quot; is a flexible measure of work. You define what constitutes one unit within each UPH Target by setting the &quot;Documents per Unit&quot; and &quot;Video Sessions per Unit&quot;.
                <br />
                <em>Example: For a target where 10 docs = 1 unit and 1.5 videos = 1 unit:
                <br />- Completing 20 documents = 2 units.
                <br />- Completing 3 video sessions = 2 units.
                <br />- Completing 10 documents AND 1.5 videos = 2 units total (1 from docs + 1 from videos).</em>
              </li>
              <li>
                <strong>UPH (Units Per Hour):</strong> This is calculated as:
                <code>(Total Units Completed) / (Net Hours Worked)</code>.
              </li>
              <li>
                <strong>Net Hours Worked:</strong> This is your total shift time (End Time - Start Time) minus any Break and Training durations.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-lg">Getting Started (No Data)</h3>
            <p>
              If you&apos;re new and see a welcome screen:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <strong>Load Sample Data:</strong> Click &quot;Load Sample Data&quot; on the dashboard to populate the app with example logs and targets. This helps you explore features immediately. You can clear this data later from the dashboard using the &quot;Clear All My Data&quot; button.
              </li>
              <li>
                <strong>Set Up & Start Tracking:</strong>
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  <li>Go to the &quot;Log / Targets&quot; page via the sidebar.</li>
                  <li>In the &quot;UPH Target Manager,&quot; click &quot;Add New Target.&quot; Define your first target (e.g., name it &quot;Standard Day,&quot; set your target UPH, and specify how many docs/videos make one unit for this target). The first target you add will automatically become active.</li>
                  <li>In the &quot;Work Log Input Form&quot; on the same page, enter your details for today (or a past day) and click &quot;Save Log.&quot;
                  </li>
                  <li>Alternatively, if you have an active target, you can click "Start New Day" on the Dashboard to quickly create a log for today with default times.</li>
                </ul>
              </li>
            </ol>
          </section>

           <section>
            <h3 className="font-semibold text-lg">Tips for Success</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keep your logs updated daily for the most accurate tracking and insights.</li>
              <li>Use the &quot;Quick Update&quot; on the dashboard for fast entry of today&apos;s document and video counts.</li>
              <li>Remember to log breaks and training time accurately as they affect your net work hours and UPH.</li>
              <li>Create and adjust UPH targets as your goals or work requirements change.</li>
               <li>The theme (Light/Dark/System) can be changed using the toggle in the sidebar footer (bottom-left).</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialDialog;