import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { postCreateRecommendationService } from "../../services/backend";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
function RecommendationForm() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { token } = useContext(AuthContext);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [lean_in, setLean_in] = useState("");
  //   const [image, setImage] = useState("");
  const [setError] = useState("");

  if (!user) {
    return <div>You must be logged in</div>;
  }

  const handleForm = async (e) => {
    e.preventDefault();

    try {
      await postCreateRecommendationService(
        title,
        category,
        description,
        country,
        lean_in,
        token
      );
      navigate("/recommendations");
    } catch (error) {
      setError(error);
    }
  };

  return (
    <>
      <Form className="w-75 mx-auto mt-5">
        <Form.Group className="mb-3">
          <Form.Label className="mb-3">Create Title</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter new title"
            required
            className="mb-3"
            onChange={(e) => setTitle(e.target.value)}
            value={title}
            name="title"
            id="title"
          />
          <Form.Text className="text-muted mb-3">
            Try to be as descriptive as possible.
          </Form.Text>
        </Form.Group>
        <Form.Group>
          <Form.Select
            className="mb-3"
            aria-label="Default select example"
            onChange={(e) => setCategory(e.target.value)}
            value={category}
            name="category"
            id="category">
            <option>Select your category</option>
            <option value="1">Beach</option>
            <option value="2">Historic</option>
            <option value="3">Nature</option>
          </Form.Select>
          <Form.Control
            as="textarea"
            rows={3}
            className="mb-3"
            placeholder="Enter new description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
            name="description"
            id="description"
          />
          <Form.Label className="text-muted mb-3">
            Tell us about your trip
          </Form.Label>
        </Form.Group>
        <Form.Group>
          <Form.Label className="mb-3">Choose the country</Form.Label>

          <Form.Control
            type="text"
            placeholder="Enter the country"
            required
            className="mb-3"
            onChange={(e) => setCountry(e.target.value)}
            value={country}
            name="country"
            id="country"
          />
        </Form.Group>
        <Form.Group>
          <Form.Label className="text-muted mb-3">Hashtags</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            className="mb-3"
            placeholder="Enter hashtags"
            onChange={(e) => setLean_in(e.target.value)}
            value={lean_in}
            name="lean_in"
            id="lean_in"
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Upload your favorite photos from the trip!</Form.Label>
          <Form.Control type="file" />
        </Form.Group>
        <Link
          to="/recommendations"
          onClick={handleForm}>
          <Button
            variant="primary"
            type="submit">
            Create recommendation!
          </Button>
        </Link>
      </Form>
    </>
  );
}

export default RecommendationForm;
