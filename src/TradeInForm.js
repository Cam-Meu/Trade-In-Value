import { useState, useEffect } from "react";
import axios from "axios";

// Input style remains unchanged
const customInputStyle = {
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  paddingTop: "0.5rem",
  paddingBottom: "0.5rem",
  marginTop: "0.25rem",
  borderWidth: "1px",
  borderColor: "#D1D5DB",
  borderStyle: "solid",
  borderRadius: "0.375rem",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  fontSize: "0.875rem",
};

// Environment variables and API constants
const authKey = process.env.REACT_APP_AUTHKEY;
const webhookUrl = process.env.REACT_APP_WEBHOOK_URL;
const endUrl = process.env.REACT_APP_END_URL; // End URL from env variables

const api = axios.create({
  baseURL: "https://api.vehicledatabases.com",
  headers: { "x-AuthKey": authKey },
});

const states = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE",
  "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY",
];

export default function TradeInForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    year: "",
    make: "",
    model: "",
    state: states[0],
    miles: "",
    name: "",
    email: "",
    phone: "",
  });
  const [years, setYears] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  
  // State to store UTM parameters received from the parent
  const [utmData, setUtmData] = useState({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_id: "",
    utm_term: "",
    fbclid: ""
  });
  
  // States for overlay spinner, button loading text, and error message
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // -----------------------------
  // MESSAGE LISTENER FOR UTMs FROM PARENT
  // -----------------------------
  useEffect(() => {
    function receiveMessage(event) {
      // Optionally, add a check for event.origin here
      if (event.data && event.data.utmData) {
        console.log("Received UTM data via postMessage:", event.data.utmData);
        setUtmData(event.data.utmData);
      }
    }
    window.addEventListener("message", receiveMessage, false);
    return () => window.removeEventListener("message", receiveMessage);
  }, []);
  
  // -----------------------------
  // FETCH FUNCTIONS
  // -----------------------------
  const fetchYears = async () => {
    setIsStarted(true);
    try {
      await api.get("/ymm-specs/options/v2/year").then(response => {
        const yearOptions = ["Select Years", ...response.data.years];
        setYears(yearOptions);
      });
    } catch (err) {
      console.error("Error fetching years:", err);
    } finally {
      setIsStarted(false);
    }
  };
  
  const fetchMakes = async (year) => {
    setIsStarted(true);
    try {
      await api.get(`/ymm-specs/options/v2/make/${year}`).then(response => {
        const makeOptions = ["Select Makes", ...response.data.makes];
        setMakes(makeOptions);
      });
    } catch (err) {
      console.error("Error fetching makes:", err);
    } finally {
      setIsStarted(false);
    }
  };
  
  const fetchModels = async (year, make) => {
    setIsStarted(true);
    try {
      await api.get(`/ymm-specs/options/v2/model/${year}/${make}`)
        .then(response => {
          const modelOptions = ["Select Models", ...response.data.models];
          setModels(modelOptions);
        });
    } catch (err) {
      console.error("Error fetching models:", err);
    } finally {
      setIsStarted(false);
    }
  };

  // -----------------------------
  // MAIN SUBMISSION (MARKET VALUE)
  // -----------------------------
  const fetchMarketValues = async () => {
    setIsStarted(true);
    try {
      await api.get(
        `/market-value/v2/ymm/${formData.year}/${formData.make}/${formData.model}?state=${formData.state}&mileage=${formData.miles}`
      ).then(async res => {
        const marketValueData = res.data.data.market_value.market_value_data;
        const objectArray = marketValueData.map(item => {
          const marketValueObject = item["market value"].reduce((acc, curr) => {
            acc[curr.Condition] = {
              Trade_In: curr["Trade-In"],
              Private_Party: curr["Private Party"],
              Dealer_Retail: curr["Dealer Retail"],
            };
            return acc;
          }, {});
          return { trim: item.trim, market_value: marketValueObject };
        });
        const jsonObject = objectArray.reduce((acc, item, index) => {
          acc[`item${index}`] = item;
          return acc;
        }, {});
        
        // Build the webhook payload including UTM data
        const payload = {
          marketValue: jsonObject,
          form_data: formData,
          utm_source: utmData.utm_source,
          utm_medium: utmData.utm_medium,
          utm_campaign: utmData.utm_campaign,
          utm_content: utmData.utm_content,
          utm_id: utmData.utm_id,
          utm_term: utmData.utm_term,
          fbclid: utmData.fbclid,
        };
        console.log("Webhook payload:", payload);
        const webhookRes = await axios.post(webhookUrl, payload);
        if (webhookRes.status === 200) {
          const finalUrl = new URL(endUrl);
          finalUrl.hash = "done";
          finalUrl.searchParams.set("utm_name", formData.name);
          finalUrl.searchParams.set("utm_email", formData.email);
          finalUrl.searchParams.set("utm_phone", formData.phone);
          window.top.location.href = finalUrl.toString();
        }
      });
    } catch (err) {
      console.error("Error fetching market value:", err);
      setError("There was an error submitting your request. Please try again.");
    } finally {
      setIsStarted(false);
    }
  };

  // -----------------------------
  // INITIAL DATA FETCH HOOKS
  // -----------------------------
  useEffect(() => { fetchYears(); }, []);
  useEffect(() => { if (formData.year) fetchMakes(formData.year); }, [formData.year]);
  useEffect(() => { if (formData.year && formData.make) fetchModels(formData.year, formData.make); }, [formData.year, formData.make]);

  // -----------------------------
  // HANDLERS & VALIDATION
  // -----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "miles") {
      const sanitized = value.replace(/[^\d]/g, "");
      setFormData(prev => ({ ...prev, miles: sanitized }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep1 = () => {
    const required = ["year", "make", "model", "state", "miles"];
    const missing = required.filter(field => !formData[field]);
    if (missing.length > 0) {
      setError(`Please fill in all required fields: ${missing.join(", ")}`);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const required = ["name", "email", "phone"];
    const missing = required.filter(field => !formData[field]);
    if (missing.length > 0) {
      setError(`Please fill in all required fields: ${missing.join(", ")}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (step === 1) {
      if (validateStep1()) setStep(2);
      setIsLoading(false);
      return;
    }
    if (validateStep2()) {
      try {
        await fetchMarketValues();
        setFormData({
          year: "",
          make: "",
          model: "",
          state: states[0],
          miles: "",
          name: "",
          email: "",
          phone: "",
        });
        setStep(1);
      } catch (err) {
        console.error("Submission error:", err);
        setError("There was an error submitting your request. Please try again.");
      }
    }
    setIsLoading(false);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="w-full mx-auto p-5 bg-white rounded-lg shadow-md">
      {isStarted && (
        <div className="absolute top-0 left-0 h-screen w-screen opacity-70 bg-black">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          <>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="state">State</label>
              <select name="state" style={customInputStyle} value={formData.state} onChange={e => handleSelectChange("state", e.target.value)}>
                {states.map(state => (
                  <option key={state} value={state} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">{state}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="year">Year</label>
              <select name="year" style={customInputStyle} value={formData.year} onChange={e => handleSelectChange("year", e.target.value)}>
                {years.map(yearOption => (
                  <option key={yearOption} value={yearOption} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">{yearOption}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="make">Make</label>
              <select name="make" style={customInputStyle} value={formData.make} onChange={e => handleSelectChange("make", e.target.value)}>
                {makes.map(makeOption => (
                  <option key={makeOption} value={makeOption} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">{makeOption}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="model">Model</label>
              <select name="model" style={customInputStyle} value={formData.model} onChange={e => handleSelectChange("model", e.target.value)}>
                {models.map(modelOption => (
                  <option key={modelOption} value={modelOption} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">{modelOption}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="miles">Miles</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" id="miles" className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" name="miles" value={formData.miles} onChange={handleChange} placeholder="Enter miles" />
            </div>
            <button type="submit" className="w-full px-4 py-2 mt-2 text-white bg-black rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50" disabled={isLoading}>
              {isLoading ? "Loading..." : "Next"}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="name">Name</label>
              <input type="text" id="name" className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="email">Email</label>
              <input type="email" id="email" className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" />
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="phone">Phone</label>
              <input type="tel" id="phone" className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter your phone number" />
            </div>
            <button type="submit" className="w-full px-4 py-2 mt-2 text-white bg-black rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Get My Trade-In Value"}
            </button>
            <p className="text-sm text-red-600 mt-2">
              Warning! Make sure your information is correct because we will text/email you the final report!
            </p>
          </>
        )}
      </form>
    </div>
  );
}
