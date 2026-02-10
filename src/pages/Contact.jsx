import React from "react";

function Contact() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold text-blue-800 mb-6">
        Contact & Support
      </h1>

      <p className="mb-6 text-gray-700 max-w-3xl">
        If you experience a medical emergency, please contact your local
        emergency services immediately. For VitalWatch support, feedback, or
        project-related queries, reach out using the details below.
      </p>

      {/* Technical / Academic Support */}
      <div className="bg-blue-50 p-5 rounded-lg shadow-md mb-6 border border-blue-100">
        <h2 className="text-2xl font-semibold text-blue-700 mb-3">
          Technical & Research Support
        </h2>
        <ul className="text-gray-800 space-y-1">
          <li>
            <span className="font-bold">Advisor:</span> Dr. Sumith Satheendran S.
          </li>
          <li>
            <span className="font-bold">Role:</span> Assistant Professor
          </li>
          <li>
            <span className="font-bold">Laboratory:</span> Natural Resource
            Monitoring Laboratory (Amrita-NRML)
          </li>
          <li>
            <span className="font-bold">Institution:</span> Amrita Vishwa
            Vidyapeetham, Amritapuri Campus
          </li>
          <li>
            <span className="font-bold">Email:</span> remotesumithsat@gmail.com /{" "}
            sumithss@am.amrita.edu
          </li>
          <li>
            <span className="font-bold">Phone:</span> +91 9446529777
          </li>
          <li>
            <span className="font-bold">Website:</span>{" "}
            <a
              href="https://www.amrita.edu/faculty/sumith-satheendran/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              Profile Page
            </a>
          </li>
        </ul>
      </div>

      {/* Developer / App Contact */}
      <div className="bg-blue-50 p-5 rounded-lg shadow-md border border-blue-100">
        <h2 className="text-2xl font-semibold text-blue-700 mb-3">
          VitalWatch App Contact
        </h2>
        <ul className="text-gray-800 space-y-1">
          <li>
            <span className="font-bold">Name:</span> Vipinlal P
          </li>
          <li>
            <span className="font-bold">Email:</span> vipinlal.p.123@gmail.com
          </li>
          <li>
            <span className="font-bold">Phone:</span> +91 8848047674
          </li>
          <li>
            <span className="font-bold">Background:</span> MSc Geoinformatics,
            IGNOU
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Contact;
