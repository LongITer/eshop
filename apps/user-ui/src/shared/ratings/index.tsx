import { Star } from "lucide-react";
import React, { FC } from "react";

type Props = {
  rating: number;
};

const Ratings: FC<Props> = ({ rating }) => {
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(
        <Star key={`star-${i}`} size={16} fill="#facc15" color="#facc15" />
      );
    } else {
      stars.push(<Star key={`empty-${i}`} size={16} color="#d1d5db" />);
    }
  }

  return <div className="flex items-center gap-1">{stars}</div>;
};

export default Ratings;
