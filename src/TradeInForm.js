import { useState, useEffect } from "react";
import axios from "axios";

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

const authKey = process.env.REACT_APP_AUTHKEY;
const webhookUrl = process.env.REACT_APP_WEBHOOK_URL;
const endUrl = process.env.REACT_APP_END_URL;

const api = axios.create({
  baseURL: "https://api.vehicledatabases.com",
  headers: {
    "x-AuthKey": authKey,
  },
});

const states = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function TradeInForm() {
  // Detect if the app is embedded in an iframe.
  const isEmbedded = typeof window !== "undefined" && window.self !== window.top;

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
  const [isStarted, setIsStarted] = useState(false);

  const fetchYears = async () => {
    try {
      await api.get("/ymm-specs/options/v2/year").then((response) => {
        const yearOptions = ["Select Years", ...response.data.years];
        setYears(yearOptions);
        setIsStarted(false);
      });
    } catch (error) {
      console.log("Error fetching 'years' data", error);
    }
  };

  const fetchMakes = async (year) => {
    try {
      await api.get(`/ymm-specs/options/v2/make/${year}`).then((response) => {
        let makesOptions = ["Select Makes"];
        makesOptions.push(...response.data.makes);
        setMakes(makesOptions);
        setIsStarted(false);
      });
    } catch (error) {
      console.log("Error fetching 'makes' data", error);
    }
  };

  const fetchModels = async (year, make) => {
    try {
      await api.get(`/ymm-specs/options/v2/model/${year}/${make}`).then((response) => {
        let modelsOptions = ["Select Models"];
        modelsOptions.push(...response.data.models);
        setModels(modelsOptions);
        setIsStarted(false);
      });
    } catch (error) {
      console.log("Error fetching 'models' data", error);
    }
  };

  const fetchMarketValues = async () => {
    try {
      await api
        .get(
          `/market-value/v2/ymm/${formData.year}/${formData.make}/${formData.model}?state=${formData.state}&mileage=${formData.miles}`
        )
        .then(async (res) => {
          const marketValueData = res.data.data.market_value.market_value_data;
          const objectArray = marketValueData.map((item) => {
            const marketValueObject = item["market value"].reduce(
              (acc, curr) => {
                acc[curr.Condition] = {
                  Trade_In: curr["Trade-In"],
                  Private_Party: curr["Private Party"],
                  Dealer_Retail: curr["Dealer Retail"],
                };
                return acc;
              },
              {}
            );
            return { trim: item.trim, market_value: marketValueObject };
          });
          const jsonObject = objectArray.reduce((acc, item, index) => {
            acc[`item${index}`] = item;
            return acc;
          }, {});

          const payload = { marketValue: jsonObject, form_data: formData };
          const webhookRes = await axios.post(webhookUrl, payload);
          if (webhookRes.status === 200) {
            const redirectUrl = endUrl || "https://trade-in.airparkdodgechryslerjeeps.com/#done";
            window.location.href = redirectUrl;
          }
          console.log(webhookRes);
        });
    } catch (error) {
      console.log("Error fetching 'market value' data", error);
      setError("There was an error submitting your request. Please try again.");
    }
  };

  useEffect(() => {
    setIsStarted(true);
    fetchYears();
  }, []);

  useEffect(() => {
    if (formData.year) {
      setIsStarted(true);
      fetchMakes(formData.year);
    }
  }, [formData.year]);

  useEffect(() => {
    if (formData.year && formData.make) {
      setIsStarted(true);
      fetchModels(formData.year, formData.make);
    }
  }, [formData.year, formData.make]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const validateStep1 = () => {
    const requiredFields = ["year", "make", "model", "state", "miles"];
    const emptyFields = requiredFields.filter((field) => !formData[field]);
    if (emptyFields.length > 0) {
      setError(`Please fill in all required fields: ${emptyFields.join(", ")}`);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const requiredFields = ["name", "email", "phone"];
    const emptyFields = requiredFields.filter((field) => !formData[field]);
    if (emptyFields.length > 0) {
      setError(`Please fill in all required fields: ${emptyFields.join(", ")}`);
      return false;
    }
    return true;
  };

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
          // Only reset if not redirected
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
        } catch (error) {
          console.error("Error:", error);
          setError("There was an error submitting your request. Please try again.");
        }
      }
    }
    setIsLoading(false);
  };

  return (
    // When embedded, remove the fixed height class so that the container sizes naturally.
    <div className={isEmbedded ? "w-full p-5 bg-white rounded-lg shadow-md" : "w-full h-full p-5 bg-white rounded-lg shadow-md"} style={{ position: "relative" }}>
      {(!isEmbedded && isStarted) && (
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
              <label className="block text-left pl-3 text-sm font-medium text-gray-700" htmlFor="state">
                State
              </label>
              <select
                name="state"
                style={customInputStyle}
                value={formData.state}
                onChange={(e) => handleSelectChange("state", e.target.value)}
              >
                {states.map((state) => (
                  <option key={state} value={state} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {state}
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
                {years.map((year) => (
                  <option key={year} value={year} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {year}
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
                {makes.map((make) => (
                  <option key={make} value={make} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {make}
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
                {models.map((model) => (
                  <option key={model} value={model} className="text-sm text-gray-700 hover:bg-gray-100 w-full text-center">
                    {model}
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
              Warning! Make sure your information is correct because we will
              text/email you the final report!
            </p>
          </>
        )}
      </form>
    </div>
  );
}
