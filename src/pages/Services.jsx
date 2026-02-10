import React from "react";

function Services() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold text-blue-800 mb-4">
        VitalWatch Services
      </h1>

      <p className="text-gray-700 mb-6 max-w-3xl">
        VitalWatch provides smart, reliable health-monitoring tools designed to
        help individuals track vital signs, understand health trends, and make
        informed lifestyle decisions.
      </p>

      <ul className="list-disc pl-6 space-y-3 text-gray-800">
        <li>
          <strong>Real-Time Vital Monitoring:</strong> Track key health metrics
          such as heart rate, activity levels, and other vital indicators in
          real time.
        </li>
        <li>
          <strong>Health Trend Analysis:</strong> Analyze long-term patterns to
          identify improvements, risks, or irregular health behaviors.
        </li>
        <li>
          <strong>Personalized Health Insights:</strong> Receive data-driven
          insights and summaries tailored to individual health profiles.
        </li>
        <li>
          <strong>Alerts & Notifications:</strong> Get timely alerts for unusual
          readings or when predefined health thresholds are crossed.
        </li>
        <li>
          <strong>Secure Data Management:</strong> Your health data is stored
          securely with privacy-first design and controlled access.
        </li>
      </ul>
    </div>
  );
}

export default Services;
