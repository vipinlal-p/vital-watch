import React from "react";

function News() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold text-blue-800 mb-6">
        Health News & Updates
      </h1>

      <div className="space-y-4">
        <div className="bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Monthly Health Insights – August 2025
          </h2>
          <p className="text-sm text-gray-600">Posted on September 2, 2025</p>
          <p className="text-gray-800">
            Recent trends indicate improvements in daily activity levels and
            sleep consistency among users. Explore detailed health summaries in
            your VitalWatch dashboard.
          </p>
        </div>

        <div className="bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Smart Health Alerts Now Live
          </h2>
          <p className="text-sm text-gray-600">Posted on August 25, 2025</p>
          <p className="text-gray-800">
            VitalWatch now provides real-time notifications for unusual vital
            readings, helping users respond proactively to health changes.
          </p>
        </div>

        <div className="bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Webinar: Understanding Your Health Data
          </h2>
          <p className="text-sm text-gray-600">Posted on August 10, 2025</p>
          <p className="text-gray-800">
            Join healthcare and data experts for an interactive session on
            interpreting health metrics and building healthier routines using
            VitalWatch.
          </p>
        </div>
      </div>
    </div>
  );
}

export default News;
