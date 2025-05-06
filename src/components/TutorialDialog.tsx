import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter, // Import DialogFooter
  DialogClose, // Import DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const tutorialPages = [
  {
    title: "Dashboard Overview",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">1. Dashboard Overview (Home Page)</h3>
        <p className="mb-2">
          This is your main hub for tracking daily productivity. Key features include:
        </p>

        <h4 className="font-medium text-md mt-4 mb-1">Quick Updates & Time Logging:</h4>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Quick Update Counts:</strong> Easily log completed documents and video sessions for today directly from the dashboard. Your UPH and progress indicators will update in real-time.
          </li>
          <li>
            <strong>Log Non-Work Time:</strong> Quickly add common break durations (15m, 30m) or short training sessions (5m). These adjust your total work hours, impacting UPH calculations.
          </li>
        </ul>

        <h4 className="font-medium text-md mt-4 mb-1">Performance Insights:</h4>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>
            <strong>Weekly Average UPH:</strong> Displays your average Units Per Hour for the selected week (Monday-Sunday), based on your active target. Use the arrow buttons to navigate between weeks.
          </li>
          <li>
            <strong>Today’s Target Progress:</strong> This card provides a detailed look at your progress towards your active UPH target for the current day. It shows:
            <ul className="list-disc pl-5 space-y-0.5 mt-2">
              <li>Current units completed versus the target units required for the day so far.</li>
              <li>Your current UPH against the goal UPH of your active target.</li>
              <li><strong>Schedule Status:</strong> Indicates if you are ahead or behind schedule to meet your goal by your shift&apos;s end, and by how much time.</li>
              <li><strong>Estimated Goal Hit Time:</strong> Predicts when you might achieve your daily UPH goal based on your current pace and scheduled end time.</li>
            </ul>
          </li>
          <li>
            <strong>Today&apos;s Metrics:</strong> A summary of your performance against all defined UPH targets for the current day, offering a comprehensive view of your productivity.
          </li>
        </ul>
        <h4 className="font-medium text-md mt-4 mb-1">Data Management:</h4>
         <ul className="list-disc pl-5 space-y-1">
           <li>
            <strong>Clear All Data:</strong> A button to reset all application data, including logs and targets. Use this with caution as it&apos;s irreversible.
          </li>
        </ul>
      </>
    )
  },
  {
    title: "Log Input & Targets",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">2. Log Input / Targets Page</h3>
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
          <li>Break Duration and optional Training Duration (both in minutes).</li>
          <li>Number of Documents Completed and Video Sessions Completed.</li>
          <li>An optional field for any Notes relevant to the day.</li>
        </ul>
        <p className="mb-2">
          The form automatically calculates your <strong>Net Work Hours</strong> based on the shift times and any non-work durations entered. When a log is saved, it&apos;s automatically associated with your currently active UPH target.
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
            <strong>Define Units:</strong> Crucially, set how many <strong>Documents per Unit</strong> and <strong>Video Sessions per Unit</strong> are required to constitute ONE unit for this specific target. This allows for flexible unit definitions (e.g., 5.25 docs = 1 unit).
          </li>
          <li>
            <strong>Activate Target:</strong> Mark one target as &quot;active.&quot; This active target is used for the main dashboard progress indicators and as the default for new log calculations.
          </li>
          <li>
            <strong>Edit/Delete:</strong> Modify or remove existing targets. Note: An active target cannot be deleted directly; you must activate another target first.
          </li>
          <li><strong>Sort Columns:</strong> Click on column headers (like Name, Target UPH) to sort the list of targets.</li>
        </ul>
      </>
    )
  },
  {
    title: "Previous Logs & UPH",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">3. Previous Logs Page</h3>
        <p className="mb-3">
          Review your past performance and detailed metrics for previous workdays.
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>
            <strong>Log Summary:</strong> Each past day&apos;s log is displayed in a collapsible summary. Click on an entry to expand it and view detailed metrics.
          </li>
          <li>
            <strong>Detailed Metrics:</strong> When a log entry is expanded, you&apos;ll see a comprehensive breakdown of your performance against all your defined UPH targets for that specific day. This includes units completed, average UPH achieved, and the difference from each target&apos;s goal.
          </li>
          <li>
            <strong>Delete Logs:</strong> You can remove individual past log entries using the trash icon associated with each log summary.
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
              <em>Example: If a target has 10 Documents per Unit and 2 Video Sessions per Unit:
              <br />- Completing 20 documents contributes 2 units (20 docs / 10 docs/unit).
              <br />- Completing 3 video sessions contributes 1.5 units (3 videos / 2 videos/unit).
              <br />- If both occurred, your total units for that target would be 3.5 units (2 from docs + 1.5 from videos).</em>
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
  },
  {
    title: "Getting Started & Tips",
    content: (
      <>
        <h3 className="font-semibold text-lg mb-3">Getting Started (No Data)</h3>
        <p className="mb-3">
          If you&apos;re launching the app for the first time and see a welcome screen with no data, you have a couple of options:
        </p>
        <ol className="list-decimal pl-5 space-y-3 mb-4">
          <li>
            <strong className="block mb-1">Load Sample Data:</strong>
            <p>Click the &quot;Load Sample Data&quot; button on the dashboard. This will populate the app with example work logs and UPH targets, allowing you to explore all features immediately. You can easily clear this sample data later from the dashboard using the &quot;Clear All My Data&quot; button when you&apos;re ready to input your own information.</p>
          </li>
          <li>
            <strong className="block mb-1">Set Up & Start Tracking Manually:</strong>
            <p className="mb-1">If you prefer to start with your own data:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Navigate to the &quot;Log / Targets&quot; page using the sidebar.</li>
              <li>In the &quot;UPH Target Manager&quot; section, click &quot;Add New Target.&quot; Define your first target: give it a name (e.g., &quot;Standard Day&quot;), set your desired target UPH, and specify how many documents and video sessions make up one unit for this particular target. The first target you add will automatically become active.</li>
              <li>Once you have an active target, you can either fill out the &quot;Work Log Input Form&quot; on the same page for today (or a past day) and click &quot;Save Log,&quot; or go back to the Dashboard and click the &quot;Start New Day&quot; button to quickly create a log for today with default shift times.</li>
            </ul>
          </li>
        </ol>

         <h3 className="font-semibold text-lg mt-6 mb-3">Tips for Success</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Consistency is Key:</strong> Keep your logs updated daily for the most accurate tracking, insights, and progress visualization.</li>
          <li><strong>Use Quick Updates:</strong> For rapid entry of today&apos;s document and video counts, use the &quot;Quick Update&quot; feature on the dashboard.</li>
          <li><strong>Log Non-Work Time:</strong> Remember to accurately log your breaks and any training time. This ensures your net work hours and UPH calculations are correct.</li>
          <li><strong>Adapt Your Targets:</strong> Create and adjust UPH targets as your goals or work requirements change. Having multiple targets helps you analyze performance under different conditions.</li>
           <li><strong>Theme Customization:</strong> You can change the application&apos;s theme (Light/Dark/System preference) using the toggle button located in the sidebar footer (bottom-left).</li>
        </ul>
      </>
    )
  }
];

const TutorialDialog: React.FC = () => {
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
        <Button variant="ghost" size="icon" aria-label="Open tutorial">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Metric Daily Guide ({currentPageData.title})</DialogTitle>
          <DialogDescription>
            Page {currentPage + 1} of {tutorialPages.length}. Use the buttons below to navigate.
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-3 text-foreground flex-grow">
          {/* Removed space-y-4 from here, as spacing is handled within content now */}
          <section>
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
                <Button>Close</Button>
              </DialogClose>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialDialog;
