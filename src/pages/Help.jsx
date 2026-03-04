import React from "react";
import { Link } from "react-router-dom";

function Help() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900">Vital Watch Help Center</h1>
          <Link
            to="/"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Back to Map
          </Link>
        </div>

        <p className="text-slate-700 mb-6">
          This page explains how to use the Vital Watch map platform, what each control does,
          and where to contact the project team for support.
        </p>

        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">What This Website Does</h2>
            <p>
              Vital Watch is an interactive geospatial dashboard for visualizing disease patterns,
              hotspots, trends, and nearby health-related facilities on a Kerala-focused map.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Core Features</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Search locations and navigate directly on the map.</li>
              <li>Toggle raster and vector layers for different geographic insights.</li>
              <li>View disease heatmaps and disease trend charts.</li>
              <li>Use map tools for zooming, locating, and measurement.</li>
              <li>Find nearby hospitals, police stations, and medical shops.</li>
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">How To Use</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Use the top search bar to find a place or landmark.</li>
              <li>Use the layer menu to switch disease/raster/vector visualizations.</li>
              <li>Open trends to analyze year-wise disease changes.</li>
              <li>Click the profile button on the top-right to sign in or sign out.</li>
              <li>Use the measure tool on the right to calculate distances/areas.</li>
            </ol>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Account & Access</h2>
            <p className="mb-2">
              Some features that update data require authentication. Use the circular user button
              on the map to sign in.
            </p>
            <p>
              If you face login issues, contact the app support person below.
            </p>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-3">Admins & Support Contacts</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-blue-100 p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Technical & Research Admin</h3>
                <p><span className="font-semibold">Name:</span> Dr. Sumith Satheendran S.</p>
                <p><span className="font-semibold">Role:</span> Assistant Professor</p>
                <p><span className="font-semibold">Lab:</span> Natural Resource Monitoring Laboratory (Amrita-NRML)</p>
                <p><span className="font-semibold">Institution:</span> Amrita Vishwa Vidyapeetham, Amritapuri Campus</p>
                <p><span className="font-semibold">Email:</span> remotesumithsat@gmail.com / sumithss@am.amrita.edu</p>
                <p><span className="font-semibold">Phone:</span> +91 9446529777</p>
              </div>

              <div className="bg-white rounded-lg border border-blue-100 p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Application Support</h3>
                <p><span className="font-semibold">Name:</span> Vipinlal P</p>
                <p><span className="font-semibold">Email:</span> vipinlal.p.123@gmail.com</p>
                <p><span className="font-semibold">Phone:</span> +91 8848047674</p>
                <p><span className="font-semibold">Background:</span> MSc Geoinformatics, IGNOU</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Emergency Disclaimer</h2>
            <p>
              This platform is for monitoring and analysis support. For medical emergencies,
              contact local emergency services immediately.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Help;
