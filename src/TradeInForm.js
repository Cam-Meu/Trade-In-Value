import { useState, useEffect } from "react";
import axios from "axios";

// Common style for select elements
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

// Environment variables
const authKey = process.env.REACT_APP_AUTHKEY;
const webhookUrl = process.env.REACT_APP_WEBHOOK_URL;
const endUrl = process.env.REACT_APP_END_URL;

// Axios instance
const api = axios.create({
  baseURL: "https://api.vehicledatabases.com",
  headers: {
    "x-AuthKey": authKey,
  },
});

// US states
const states = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch available years
  const fetchYears = async () => {
    try {
      const response = await api.get("/ymm-specs/options/v2/year");
      const yearOptions = ["Select Years", ...response.data.years];
      setYears(yearOptions);
    } catch (err) {
      console.error("Error fetching 'years' data:", err);
    }
  };

  // Fetch makes for selected year
  const fetchMakes = async (year) => {
    try {
      const response = await api.get(`/ymm-specs/options/v2/make/${year}`);
      const makesOptions = ["Select Makes", ...response.data.makes];
      setMakes(makesOptions);
    } catch (err) {
      console.error("Error fetching 'makes' data:", err);
    }
  };

  // Fetch models for selected year and make
  const fetchModels = async (year, make) => {
    try {
      const response = await api.get(`/ymm-specs/options/v2/model/${year}/${make}`);
      const modelsOptions = ["Select Models", ...response.data.models];
      setModels(modelsOptions);
    } catch (err) {
      console.error("Error fetching 'models' data:", err);
    }
  };

  // Fetch market values and post to webhook
  const fetchMarketValues = async () => {
    try {
      const response = await api.get(
        `/market-value/v2/ymm/${formData.year}/${formData.make}/${formData.model}?state=${formData.state}&mileage=${formData.miles}`
      );
      const marketValueData = response.data.data.market_value.market_value_data;

      // Convert market value data into an object
      const objectArray = marketValueData.map((item) => {
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

      const jsonObject = objectArray.reduce((acc, item, idx) => {
        acc[`item${idx}`] = item;
        return acc;
      }, {});

      // Post to webhook
      const payload = { marketValue: jsonObject, form_data: formData };
      const webhookRes = await axios.post(webhookUrl, payload);

      // Redirect on success
      if (webhookRes.status === 200) {
        const redirectUrl = endUrl || "https://trade-in.airparkdodgechryslerjeeps.com/#done";
        window.location.href = redirectUrl;
      }
    } catch (err) {
      console.error("Error fetching 'market value' data:", err);
      setError("There was an error submitting your request. Please try again.");
    }
  };

  // Load year data on initial render
  useEffect(() => {
    fetchYears();
  }, []);

  // Load makes when a year is selected
  useEffect(() => {
    if (formData.year) {
      fetchMakes(formData.year);
    }
  }, [formData.year]);

  // Load models when both year and make are selected
  useEffect(() => {
    if (formData.year && formData.make) {
      fetchModels(formData.year, formData.make);
    }
  }, [formData.year, formData.make]);

  // Controlled form inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validation for step 1
  const validateStep1 = () => {
    const required = ["year", "make", "model", "state", "miles"];
    const emptyFields = required.filter((field) => !formData[field]);
    if (emptyFields.length > 0) {
      setError(`Please fill in all required fields: ${emptyFields.join(", ")}`);
      return false;
    }
    return true;
  };

  // Validation for step 2
  const validateStep2 = () => {
    const required = ["name", "email", "phone"];
    const emptyFields = required.filter((field) => !formData[field]);
    if (emptyFields.length > 0) {
      setError(`Please fill in all required fields: ${emptyFields.join(", ")}`);
      return false;
    }
    return true;
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else {
      if (validateStep2()) {
        try {
          await fetchMarketValues();
          // Reset only if we haven't redirected
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
          console.error("Error:", err);
          setError("There was an error submitting your request. Please try again.");
        }
      }
    }
    setIsLoading(false);
  };

  return (
    // No forced height or absolute positioning: container grows with content
    <div className="w-full p-5 bg-white rounded-lg shadow-md">
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          <>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="state">
                State
              </label>
              <select
                name="state"
                style={customInputStyle}
                value={formData.state}
                onChange={(e) => handleSelectChange("state", e.target.value)}
              >
                {states.map((st) => (
                  <option key={st} value={st} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="year">
                Year
              </label>
              <select
                name="year"
                style={customInputStyle}
                value={formData.year}
                onChange={(e) => handleSelectChange("year", e.target.value)}
              >
                {years.map((yr) => (
                  <option key={yr} value={yr} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {yr}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="make">
                Make
              </label>
              <select
                name="make"
                style={customInputStyle}
                value={formData.make}
                onChange={(e) => handleSelectChange("make", e.target.value)}
              >
                {makes.map((mk) => (
                  <option key={mk} value={mk} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {mk}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="model">
                Model
              </label>
              <select
                name="model"
                style={customInputStyle}
                value={formData.model}
                onChange={(e) => handleSelectChange("model", e.target.value)}
              >
                {models.map((md) => (
                  <option key={md} value={md} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {md}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="miles">
                Miles
              </label>
              <input
                type="number"
                id="miles"
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                name="miles"
                value={formData.miles}
                onChange={handleChange}
                placeholder="Enter miles"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 mt-2 text-white bg-black rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Next"}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="name">
                Name
              </label>
              <input
                type="text"
                id="name"
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="phone">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 mt-2 text-white bg-black rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
              disabled={isLoading}
            >
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
