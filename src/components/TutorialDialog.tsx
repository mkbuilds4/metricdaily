
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, ChevronLeft, ChevronRight, History, Settings, LayoutDashboard, List, BarChart, Trash2, Archive, Zap } from 'lucide-react'; // Added Archive, Zap icon

const tutorialPages = [
 {
    title: "Getting Started",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">1. Getting Started</h3>
        <p className="mb-3">
          Welcome to Metric Daily! This guide will help you get started with tracking your productivity.
        </p>

        <h4 className="font-medium text-md mt-4 mb-2">If You See a Welcome Screen (No Data):</h4>
        <p className="mb-3">
          If you're launching the app for the first time and see a welcome screen, you have a couple of options:
        </p>
        <ol className="list-decimal pl-5 space-y-3 mb-4">
          <li>
            <strong className="block mb-1">Load Sample Data:</strong>
            <p>Click the &quot;Load Sample Data&quot; button on the dashboard. This will populate the app with example work logs and UPH targets, allowing you to explore all features immediately. You can easily clear this sample data later from the dashboard using the &quot;Clear Sample Data &amp; Start Fresh&quot; button (<RefreshCcw className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon) when you&apos;re ready to input your own information.</p>
          </li>
          <li>
            <strong className="block mb-1">Set Up & Start Tracking Manually:</strong>
            <p className="mb-1">If you prefer to start with your own data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Navigate to the &quot;Settings&quot; page (<Settings className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon) using the sidebar to set your default shift times and typical break/training durations (defaults are 2:00 PM - 10:30 PM, 0 break/training).</li>
              <li>Navigate to the &quot;Log / Targets&quot; page (<List className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon) using the sidebar.</li>
              <li>In the &quot;UPH Target Manager&quot; section, click &quot;Add New Target.&quot; Define your first target: give it a name (e.g., &quot;Standard Day&quot;), set your desired target UPH, and specify how many documents and video sessions make up one unit for this particular target. The first target you add will automatically become active.</li>
              <li>Once you have an active target, you can either fill out the &quot;Work Log Input Form&quot; on the same page for today (or a past day) and click &quot;Save Log,&quot; or go back to the Dashboard (<LayoutDashboard className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon) and click the &quot;Start New Day&quot; button to quickly create a log for today with your configured default times.</li>
            </ul>
          </li>
        </ol>

        <h4 className="font-medium text-md mt-6 mb-2">General Tips for Success:</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Consistency is Key:</strong> Keep your logs updated daily for the most accurate tracking, insights, and progress visualization.</li>
          <li><strong>Use Quick Updates:</strong> For rapid entry of today&apos;s document and video counts, use the &quot;Quick Update&quot; feature on the dashboard.</li>
          <li><strong>Log Non-Work Time:</strong> Remember to accurately log your breaks and any training time using the buttons on the dashboard or the main log form. This ensures your net work hours and UPH calculations are correct.</li>
          <li><strong>Configure Defaults:</strong> Visit the Settings page (<Settings className="inline-block h-3.5 w-3.5 align-text-bottom" />) to set your usual start/end times and default break/training minutes. This makes starting a new day faster.</li>
          <li><strong>Adapt Your Targets:</strong> Create and adjust UPH targets as your goals or work requirements change. Having multiple targets helps you analyze performance under different conditions. Use the duplicate feature to easily create variations.</li>
           <li><strong>Theme Customization:</strong> You can change the application&apos;s theme (Light/Dark/System preference) using the toggle button located in the sidebar footer (bottom-left).</li>
           <li><strong>Access This Guide:</strong> You can always access this guide by clicking the <HelpCircle className="inline-block h-4 w-4 align-text-bottom" /> icon in the sidebar footer.</li>
           <li><strong>Audit Log Access:</strong> The Audit Log (<History className="inline-block h-4 w-4 align-text-bottom" /> icon) is accessible from the sidebar.</li>
        </ul>
      </>
    )
  },
  {
    title: "Dashboard Overview",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">2. Dashboard Overview (Home Page <LayoutDashboard className="inline-block h-4 w-4 align-text-bottom" />)</h3>
        <p className="mb-2">
          This is your main hub for tracking daily productivity. Key features include:
        </p>

        <h4 className="font-medium text-md mt-4 mb-1">Quick Updates & Time Logging:</h4>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Quick Update Counts:</strong> Easily log completed documents and video sessions for today directly from the dashboard using the input fields or +/- buttons. Your UPH and progress indicators will update in real-time.
          </li>
          <li>
            <strong>Log Non-Work Time:</strong> Quickly add common break durations (15m, 30m) or short training sessions (5m) using the dedicated buttons. These adjust your total work hours, impacting UPH calculations.
          </li>
           <li>
            <strong>Start New Day:</strong> If no log exists for today, a button appears here allowing you to quickly create one using your default settings.
          </li>
        </ul>

        <h4 className="font-medium text-md mt-4 mb-1">Performance Insights:</h4>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Weekly Average UPH:</strong> Displays your average Units Per Hour for the selected week (Monday-Sunday), calculated based on your active target. Use the arrow buttons to navigate between weeks.
          </li>
          <li>
            <strong>Today’s Target Progress:</strong> This card provides a detailed look at your progress towards your active UPH target for the current day. It shows:
            <ul className="list-disc pl-5 space-y-0.5 mt-2">
              <li>Current units completed versus the target units required for the day so far.</li>
              <li>Your current UPH against the goal UPH of your active target.</li>
              <li><strong>Schedule Status:</strong> Indicates if you are ahead or behind schedule to meet your goal by your shift&apos;s end, and by how much time (including seconds). Shows "Met at [Time]" once the goal is achieved for the day.</li>
              <li><strong>Estimated Goal Hit Time:</strong> Predicts when you might achieve your daily UPH goal based on your current pace and scheduled end time. Displays '-' once the goal is met.</li>
            </ul>
          </li>
          <li>
            <strong>Today's Metrics:</strong> A summary of your performance against all defined UPH targets for the current day, offering a comprehensive view of your productivity in individual cards per target. You can click a target's card to make it the active target for dashboard calculations (unless auto-switch is enabled).
          </li>
        </ul>
        <h4 className="font-medium text-md mt-4 mb-1">Data Management:</h4>
         <ul className="list-disc pl-5 space-y-1">
           <li>
            <strong>Clear Sample Data:</strong> If you loaded sample data, a button appears here to remove it and start fresh.
          </li>
           <li>
            <strong>End Today's Log:</strong> Click the <Archive className="inline-block h-4 w-4 align-text-bottom" /> icon button to finalize the log for the current day. This marks the log as complete (useful for accurate record-keeping) and it will appear under 'Previous Logs' starting the next calendar day.
          </li>
        </ul>
      </>
    )
  },
  {
    title: "Log Input & Targets",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">3. Log Input / Targets Page (<List className="inline-block h-4 w-4 align-text-bottom" />)</h3>
        <p className="mb-3">
          This page is central to managing your daily work logs and defining your UPH (Units Per Hour) targets.
        </p>

        <h4 className="font-medium text-md mt-4 mb-2">Work Log Input Form:</h4>
        <p className="mb-2">
          Here, you can add new work logs or update existing ones for any day. The form includes:
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Date selection for the log entry.</li>
          <li>Start Time and End Time of your shift (in HH:mm format).</li>
          <li>Break Duration and optional Training Duration (both in minutes). Defaults can be set on the Settings page.</li>
          <li>Number of Documents Completed and Video Sessions Completed.</li>
          <li>An optional field for any Notes relevant to the day.</li>
        </ul>
        <p className="mb-2">
          The form automatically calculates your <strong>Net Work Hours</strong> based on the shift times and any non-work durations entered. When a log is saved, it&apos;s automatically associated with your currently active UPH target. Use the "Reset to Today's Defaults" button to quickly populate the form with today's date and your saved default times/durations.
        </p>

        <h4 className="font-medium text-md mt-4 mb-2">UPH Target Manager:</h4>
        <p className="mb-2">
          This section allows you to create, manage, and activate different UPH targets. For each target, you can:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Define Name:</strong> Give your target a descriptive name (e.g., &quot;Standard Day,&quot; &quot;Meeting Coverage,&quot; &quot;Peak Performance&quot;).
          </li>
          <li>
            <strong>Set Target UPH:</strong> Specify the goal Units Per Hour for this target.
          </li>
          <li>
            <strong>Define Units:</strong> Crucially, set how many <strong>Documents per Unit</strong> and <strong>Video Sessions per Unit</strong> are required to constitute ONE unit for this specific target. This allows for flexible unit definitions (e.g., 5.25 docs = 1 unit, allowing for high decimal precision).
          </li>
          <li>
            <strong>Activate Target:</strong> Mark one target as &quot;active&quot; by clicking the <HelpCircle className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon (it turns into a checkmark <HelpCircle className="inline-block h-3.5 w-3.5 align-text-bottom text-accent" />). This active target is used for the main dashboard progress indicators and as the default for new log calculations.
          </li>
          <li>
            <strong>Edit/Delete/Duplicate:</strong> Modify, remove, or create a copy of existing targets using the icons in the Actions column. Note: An active target cannot be deleted directly; you must activate another target first.
          </li>
          <li><strong>Sort Columns:</strong> Click on column headers (like Name, Target UPH) to sort the list of targets.</li>
        </ul>
      </>
    )
  },
  {
    title: "Previous Logs, Settings & Audit", 
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">4. Previous Logs Page (<History className="inline-block h-4 w-4 align-text-bottom" />)</h3>
        <p className="mb-3">
          Review your past performance and detailed metrics for previous workdays. Only logs from dates before the current day are shown here.
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
           <li>
             <strong>Filtering & Sorting:</strong> Use the controls at the top to search logs, filter by date range, and sort the log list by various criteria (Date, Hours, Counts, Avg UPH).
           </li>
          <li>
            <strong>Log Summary (Trigger):</strong> Each past day&apos;s log is displayed in a compact summary trigger. This shows the date, hours worked, target context, key counts, and the average UPH achieved based on the log's associated target (or the active target if the log's original target is missing).
          </li>
           <li>
             <strong>Detailed Metrics (Expanded View):</strong> Click the summary trigger to expand it. You'll see a detailed summary card for that day, followed by individual cards showing your performance against *all* your defined UPH targets for that specific day. This includes units completed vs. goal and the average UPH achieved relative to *each* target definition.
           </li>
          <li>
            <strong>Delete Logs:</strong> You can remove individual past log entries using the trash icon (<Trash2 className="inline-block h-3.5 w-3.5 align-text-bottom text-destructive" />) located on the right side of each log summary trigger.
          </li>
          <li>
            <strong>Export Data:</strong> Use the &quot;Export Filtered&quot; button to download the currently filtered and sorted list of previous logs and their associated metrics to a CSV file.
          </li>
        </ul>

        <h3 className="font-semibold text-lg mt-6 mb-3">5. Settings Page (<Settings className="inline-block h-4 w-4 align-text-bottom" />)</h3>
        <p className="mb-2">
            Configure default settings for the application to streamline your workflow.
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Default Log Times:</strong> Set your typical shift Start Time and End Time (e.g., 14:00 to 22:30).
          </li>
          <li>
            <strong>Default Durations:</strong> Set the default Break and Training durations (in minutes) that will be pre-filled when starting a new day or resetting the log input form. Set these to 0 if you prefer to log them manually each day.
          </li>
          <li>
            <strong>Auto-Switch Active Target (<Zap className="inline-block h-4 w-4 align-text-bottom" />):</strong> Enable this to have the dashboard automatically select the UPH target whose progress is closest to being &quot;On Schedule&quot; as the active target. This helps dynamically focus on the most relevant target based on current performance.
          </li>
          <li>
            <strong>Usage:</strong> Default times/durations are used when you click "Start New Day" on the dashboard or "Reset to Today's Defaults" on the Log Input page.
          </li>
           <li>
             <strong>Clear All Application Data:</strong> A button to permanently delete all stored work logs, UPH targets, and saved settings. Use with caution!
           </li>
        </ul>

         <h3 className="font-semibold text-lg mt-6 mb-3">6. Audit Log Page (<History className="inline-block h-4 w-4 align-text-bottom" />)</h3>
        <p className="mb-2">
          The Audit Log tracks all significant changes made within the application for transparency and troubleshooting.
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Access:</strong> Directly accessible from the sidebar.
          </li>
           <li>
             <strong>Analytics Overview:</strong> At the top, see a quick summary of log entries by type (WorkLog, UPHTarget, etc.) and a chart showing the most frequent actions performed.
           </li>
          <li>
            <strong>Information Logged:</strong> Includes creation, updates, and deletion of work logs and UPH targets, changes to settings, as well as system events like loading sample data, clearing all data, and data exports.
          </li>
          <li>
            <strong>Details:</strong> Each entry shows the timestamp (with seconds), action performed, entity affected, and a description of the change, including previous and new states for updates where applicable.
          </li>
           <li>
            <strong>Filtering & Export:</strong> You can filter the logs by keywords, action type, entity type, and date range. Export the currently filtered view to a CSV file.
          </li>
        </ul>

        <h3 className="font-semibold text-lg mt-6 mb-3">Understanding Units and UPH</h3>
        <p className="mb-2">
          Your productivity is primarily measured in &quot;Units Per Hour&quot; (UPH). Here&apos;s how it works:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Units:</strong> A &quot;unit&quot; is a flexible measure of work output. You define what constitutes one unit within each UPH Target by setting the &quot;Documents per Unit&quot; and &quot;Video Sessions per Unit&quot; values.
            <p className="text-sm text-muted-foreground mt-1">
              <em>Example: If a target has 10 Documents per Unit and 1.5 Video Sessions per Unit:
              <br />- Completing 20 documents contributes 2 units (20 docs / 10 docs/unit).
              <br />- Completing 3 video sessions contributes 2 units (3 videos / 1.5 videos/unit).
              <br />- If both occurred, your total units for that target would be 4 units (2 from docs + 2 from videos).</em>
            </p>
          </li>
          <li>
            <strong>UPH (Units Per Hour):</strong> This is calculated by dividing your total units completed (according to the specific target&apos;s definition) by your net hours worked.
            <p className="text-sm text-muted-foreground mt-1"><code>Formula: (Total Units Completed) / (Net Hours Worked)</code></p>
          </li>
          <li>
            <strong>Net Hours Worked:</strong> This is your total shift duration (End Time - Start Time) minus any logged Break and Training durations.
          </li>
        </ul>
      </>
    )
  }
];

interface TutorialDialogProps {
  contextualTriggerText?: string; // Optional text for a more descriptive trigger button
}

const TutorialDialog: React.FC<TutorialDialogProps> = ({ contextualTriggerText }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, tutorialPages.length - 1));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset to first page when dialog is closed
      setCurrentPage(0);
    }
  };

  const currentPageData = tutorialPages[currentPage];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {contextualTriggerText ? (
          <Button variant="outline" size="lg">
            <HelpCircle className="mr-2 h-5 w-5" /> {contextualTriggerText}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Open tutorial">
            <HelpCircle className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Metric Daily Guide ({currentPageData.title})</DialogTitle>
          <DialogDescription>
            Page {currentPage + 1} of {tutorialPages.length}. You can access this guide anytime via the <HelpCircle className="inline-block h-3.5 w-3.5 align-text-bottom" /> icon in the sidebar footer.
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-3 text-foreground flex-grow">
          {/* Apply prose styles for better readability */}
          <section className="prose-p:my-2 prose-ul:my-3 prose-h3:mb-4 prose-h4:mb-2">
            {currentPageData.content}
          </section>
        </div>
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex justify-between w-full items-center">
            <Button variant="outline" onClick={handlePreviousPage} disabled={currentPage === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} / {tutorialPages.length}
            </span>
            {currentPage < tutorialPages.length - 1 ? (
              <Button onClick={handleNextPage}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <DialogClose asChild>
                <Button>Close Guide</Button>
              </DialogClose>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialDialog;
