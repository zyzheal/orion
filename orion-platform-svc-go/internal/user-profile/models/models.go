package models

type UserProfile struct {
	ID          string `json:"id" db:"id"`
	UserID      string `json:"userId" db:"user_id"`
	FirstName   string `json:"firstName" db:"first_name"`
	LastName    string `json:"lastName" db:"last_name"`
	Bio         string `json:"bio" db:"bio"`
	Timezone    string `json:"timezone" db:"timezone"`
	AvatarURL   string `json:"avatarUrl" db:"avatar_url"`
}

type UpdateProfileRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Bio       string `json:"bio"`
	Timezone  string `json:"timezone"`
	AvatarURL string `json:"avatarUrl"`
}
